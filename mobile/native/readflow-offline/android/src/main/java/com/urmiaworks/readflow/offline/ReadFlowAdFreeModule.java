package com.urmiaworks.readflow.offline;

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import com.android.billingclient.api.*;
import com.facebook.react.bridge.*;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;
import java.util.*;

/** Ad removal only. Reader features never depend on billing or a network connection. */
public final class ReadFlowAdFreeModule extends ReactContextBaseJavaModule {
    private static final String PRODUCT = "readflow_ad_free";
    private final BillingClient billing;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final List<Runnable> waiting = new ArrayList<>();
    private boolean connecting;
    private boolean closed;
    private Promise payment;
    private PublicKey publicKey;
    private final Set<String> acknowledging = new HashSet<>();
    private final Runnable timeout = () -> { connecting = false; drain(); };

    public ReadFlowAdFreeModule(ReactApplicationContext context) {
        super(context);
        billing = BillingClient.newBuilder(context).setListener(this::updated)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .enableAutoServiceReconnection().build();
    }
    @Override public String getName() { return "ReadFlowAdFree"; }
    @ReactMethod public void addListener(String name) {}
    @ReactMethod public void removeListeners(double count) {}

    private void drain() {
        List<Runnable> copy = new ArrayList<>(waiting);
        waiting.clear();
        if (!closed) for (Runnable action : copy) action.run();
    }
    private void connected(Runnable action) {
        UiThreadUtil.runOnUiThread(() -> {
            if (closed) return;
            if (billing.isReady()) { action.run(); return; }
            waiting.add(action);
            if (connecting) return;
            connecting = true;
            handler.postDelayed(timeout, 20000);
            billing.startConnection(new BillingClientStateListener() {
                @Override public void onBillingSetupFinished(BillingResult result) {
                    handler.removeCallbacks(timeout); connecting = false; drain();
                }
                @Override public void onBillingServiceDisconnected() {}
            });
        });
    }

    private boolean keyAvailable() {
        if (publicKey != null) return true;
        try (java.io.InputStream stream = getReactApplicationContext().getAssets()
                .open("readflow-billing-public-key.txt")) {
            java.io.ByteArrayOutputStream bytes = new java.io.ByteArrayOutputStream();
            byte[] buffer = new byte[1024]; int n;
            while ((n = stream.read(buffer)) != -1) bytes.write(buffer, 0, n);
            publicKey = KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(
                Base64.decode(bytes.toString("UTF-8").trim(), Base64.DEFAULT)));
            return true;
        } catch (Exception ignored) { return false; }
    }
    private boolean verified(Purchase purchase) {
        if (!keyAvailable()) return false;
        try {
            Signature signature = Signature.getInstance("SHA1withRSA");
            signature.initVerify(publicKey);
            signature.update(purchase.getOriginalJson().getBytes(StandardCharsets.UTF_8));
            return signature.verify(Base64.decode(purchase.getSignature(), Base64.DEFAULT));
        } catch (Exception ignored) { return false; }
    }
    private void acknowledge(Purchase purchase) {
        String token = purchase.getPurchaseToken();
        if (purchase.isAcknowledged() || !acknowledging.add(token)) return;
        billing.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder().setPurchaseToken(token).build(), result -> {
            // Retry failures only on a later foreground/query; no error-triggered retry loop.
            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) acknowledging.remove(token);
        });
    }
    private WritableMap entitlement(List<Purchase> purchases) throws IllegalStateException {
        boolean active = false, pending = false;
        for (Purchase purchase : purchases) {
            if (!purchase.getProducts().contains(PRODUCT)) continue;
            if (purchase.getPurchaseState() == Purchase.PurchaseState.PENDING) { pending = true; continue; }
            if (purchase.getPurchaseState() != Purchase.PurchaseState.PURCHASED) continue;
            if (!verified(purchase)) throw new IllegalStateException("Purchase verification is unavailable.");
            active = true;
            acknowledge(purchase);
        }
        WritableMap value = Arguments.createMap();
        value.putBoolean("active", active);
        value.putBoolean("pending", pending);
        return value;
    }
    private void changed() {
        if (!closed && getReactApplicationContext().hasActiveReactInstance()) {
            getReactApplicationContext().getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit("readflowAdFreeChanged", null);
        }
    }
    @ReactMethod public void status(Promise promise) {
        connected(() -> {
            if (!billing.isReady()) { promise.reject("unavailable", "Google Play is unavailable."); return; }
            billing.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build(),
                (result, purchases) -> {
                    if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                        promise.reject("unavailable", "Could not check Google Play subscriptions."); return;
                    }
                    try { promise.resolve(entitlement(purchases)); }
                    catch (Exception error) { promise.reject("verification", "Could not verify the subscription. Ads remain paused."); }
                });
        });
    }

    private void query(java.util.function.Consumer<ProductDetails> callback) {
        if (!billing.isReady() || !keyAvailable()) { callback.accept(null); return; }
        billing.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(Collections.singletonList(
            QueryProductDetailsParams.Product.newBuilder().setProductId(PRODUCT)
                .setProductType(BillingClient.ProductType.SUBS).build())).build(), (result, products) -> {
            ProductDetails found = null;
            if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                for (ProductDetails product : products.getProductDetailsList()) {
                    if (PRODUCT.equals(product.getProductId())) found = product;
                }
            }
            callback.accept(found);
        });
    }
    private ProductDetails.SubscriptionOfferDetails offer(ProductDetails product, String plan) {
        if (product == null || product.getSubscriptionOfferDetails() == null) return null;
        String period = "monthly".equals(plan) ? "P1M" : "yearly".equals(plan) ? "P1Y" : "";
        for (ProductDetails.SubscriptionOfferDetails offer : product.getSubscriptionOfferDetails()) {
            List<ProductDetails.PricingPhase> phases = offer.getPricingPhases().getPricingPhaseList();
            if (plan.equals(offer.getBasePlanId()) && offer.getOfferId() == null && phases.size() == 1
                && period.equals(phases.get(0).getBillingPeriod())
                && phases.get(0).getRecurrenceMode() == ProductDetails.RecurrenceMode.INFINITE_RECURRING) return offer;
        }
        return null;
    }
    @ReactMethod public void products(Promise promise) {
        connected(() -> query(product -> {
            WritableArray plans = Arguments.createArray();
            for (String plan : Arrays.asList("monthly", "yearly")) {
                ProductDetails.SubscriptionOfferDetails offer = offer(product, plan);
                if (offer == null) continue;
                WritableMap entry = Arguments.createMap();
                entry.putString("id", plan);
                entry.putString("price", offer.getPricingPhases().getPricingPhaseList().get(0).getFormattedPrice());
                plans.pushMap(entry);
            }
            promise.resolve(plans);
        }));
    }
    @ReactMethod public void purchase(String plan, Promise promise) {
        connected(() -> {
            if (payment != null) { promise.reject("busy", "A payment is already open."); return; }
            if (!billing.isReady() || !keyAvailable() || !("monthly".equals(plan) || "yearly".equals(plan))) {
                promise.reject("unavailable", "Subscriptions are unavailable. Reading remains free."); return;
            }
            payment = promise;
            billing.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build(),
                (result, purchases) -> {
                    if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) { fail(); return; }
                    try {
                        WritableMap current = entitlement(purchases);
                        if (current.getBoolean("active")) { finish("active"); changed(); return; }
                        if (current.getBoolean("pending")) { finish("pending"); changed(); return; }
                    } catch (Exception error) { fail(); return; }
                    query(product -> UiThreadUtil.runOnUiThread(() -> {
                        if (payment == null || closed) return;
                        Activity activity = getCurrentActivity();
                        ProductDetails.SubscriptionOfferDetails offer = offer(product, plan);
                        if (activity == null || offer == null) { fail(); return; }
                        BillingResult launched = billing.launchBillingFlow(activity, BillingFlowParams.newBuilder()
                            .setProductDetailsParamsList(Collections.singletonList(BillingFlowParams.ProductDetailsParams
                                .newBuilder().setProductDetails(product).setOfferToken(offer.getOfferToken()).build())).build());
                        if (launched.getResponseCode() != BillingClient.BillingResponseCode.OK) { fail(); changed(); }
                    }));
                });
        });
    }
    private void updated(BillingResult result, List<Purchase> purchases) {
        if (result.getResponseCode() == BillingClient.BillingResponseCode.USER_CANCELED) { finish("cancelled"); return; }
        if (result.getResponseCode() != BillingClient.BillingResponseCode.OK || purchases == null) { fail(); changed(); return; }
        try {
            WritableMap current = entitlement(purchases);
            finish(current.getBoolean("active") ? "active" : current.getBoolean("pending") ? "pending" : "cancelled");
        } catch (Exception error) { fail(); }
        changed();
    }
    private void finish(String state) { Promise current = payment; payment = null; if (current != null) current.resolve(state); }
    private void fail() {
        Promise current = payment; payment = null;
        if (current != null) current.reject("payment", "Could not confirm the subscription. Restore purchases or check Google Play before trying again.");
    }
    @Override public void invalidate() {
        closed = true; handler.removeCallbacks(timeout); waiting.clear(); billing.endConnection(); fail(); super.invalidate();
    }
}
