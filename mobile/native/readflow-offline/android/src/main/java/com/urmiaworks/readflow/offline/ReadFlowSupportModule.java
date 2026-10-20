package com.urmiaworks.readflow.offline;

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;
import com.android.billingclient.api.*;
import com.facebook.react.bridge.*;
import java.util.*;

/** Optional consumable support only: no entitlement, subscription or reader dependency. */
public final class ReadFlowSupportModule extends ReactContextBaseJavaModule implements LifecycleEventListener {
    private static final String PRODUCT = "readflow_support_1";
    private final BillingClient billing;
    private final List<Runnable> ready = new ArrayList<>();
    private final Set<String> consuming = new HashSet<>();
    private boolean connecting;
    private Promise purchasePromise;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable connectionTimeout = () -> {
        connecting = false;
        drainReady();
    };

    private void drainReady() {
        List<Runnable> pending = new ArrayList<>(ready);
        ready.clear();
        for (Runnable operation : pending) operation.run();
    }

    public ReadFlowSupportModule(ReactApplicationContext context) {
        super(context);
        billing = BillingClient.newBuilder(context)
            .setListener(this::purchasesUpdated)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .enableAutoServiceReconnection().build();
        context.addLifecycleEventListener(this);
    }

    @Override public String getName() { return "ReadFlowSupport"; }

    private void connected(Runnable action) {
        UiThreadUtil.runOnUiThread(() -> {
            if (billing.isReady()) { action.run(); return; }
            ready.add(action);
            if (connecting) return;
            connecting = true;
            handler.postDelayed(connectionTimeout, 20000);
            billing.startConnection(new BillingClientStateListener() {
                @Override public void onBillingSetupFinished(BillingResult result) {
                    handler.removeCallbacks(connectionTimeout);
                    connecting = false;
                    drainReady();
                    if (billing.isReady() && purchasePromise == null) recoverPurchases();
                }
                @Override public void onBillingServiceDisconnected() {}
            });
        });
    }

    private void queryProduct(java.util.function.Consumer<ProductDetails> callback) {
        if (!billing.isReady()) { callback.accept(null); return; }
        QueryProductDetailsParams.Product product = QueryProductDetailsParams.Product.newBuilder()
            .setProductId(PRODUCT).setProductType(BillingClient.ProductType.INAPP).build();
        billing.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder()
            .setProductList(Collections.singletonList(product)).build(), (result, products) -> {
                ProductDetails found = null;
                if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    for (ProductDetails candidate : products.getProductDetailsList()) {
                        if (PRODUCT.equals(candidate.getProductId())) found = candidate;
                    }
                }
                callback.accept(found);
            });
    }

    @ReactMethod public void product(Promise promise) {
        connected(() -> queryProduct(product -> {
            if (product == null || product.getOneTimePurchaseOfferDetails() == null) {
                promise.resolve(null); return;
            }
            WritableMap value = Arguments.createMap();
            value.putString("id", PRODUCT);
            value.putString("price", product.getOneTimePurchaseOfferDetails().getFormattedPrice());
            promise.resolve(value);
        }));
    }

    @ReactMethod public void purchase(Promise promise) {
        connected(() -> {
            if (purchasePromise != null) { promise.reject("busy", "A payment is already open."); return; }
            purchasePromise = promise;
            if (!billing.isReady()) {
                fail("unavailable", "Google Play is unavailable. Reading remains free."); return;
            }
            // Recover an unfinished contribution before offering another payment.
            billing.queryPurchasesAsync(QueryPurchasesParams.newBuilder()
                .setProductType(BillingClient.ProductType.INAPP).build(), (result, purchases) -> {
                    if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                        fail("unavailable", "Could not check pending payments. Please try later."); return;
                    }
                    for (Purchase existing : purchases) {
                        if (existing.getProducts().contains(PRODUCT)) { process(existing); return; }
                    }
                    launchContribution();
                });
        });
    }

    private void launchContribution() {
        queryProduct(product -> UiThreadUtil.runOnUiThread(() -> {
                if (purchasePromise == null) return;
                Activity activity = getCurrentActivity();
                if (activity == null || product == null || product.getOneTimePurchaseOfferDetails() == null) {
                    fail("unavailable", "Support payments are unavailable. Reading remains free."); return;
                }
                BillingFlowParams.ProductDetailsParams.Builder selection = BillingFlowParams.ProductDetailsParams
                    .newBuilder().setProductDetails(product);
                String token = product.getOneTimePurchaseOfferDetails().getOfferToken();
                if (token != null) selection.setOfferToken(token);
                BillingResult result = billing.launchBillingFlow(activity, BillingFlowParams.newBuilder()
                    .setProductDetailsParamsList(Collections.singletonList(selection.build())).build());
                if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    fail("unavailable", "Google Play could not open the payment. Please try later.");
                }
        }));
    }

    private void finish(String state) {
        Promise promise = purchasePromise;
        purchasePromise = null;
        if (promise != null) promise.resolve(state);
    }
    private void fail(String code, String message) {
        Promise promise = purchasePromise;
        purchasePromise = null;
        if (promise != null) promise.reject(code, message);
    }
    private void purchasesUpdated(BillingResult result, List<Purchase> purchases) {
        if (result.getResponseCode() == BillingClient.BillingResponseCode.USER_CANCELED) { finish("cancelled"); return; }
        if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
            fail("payment", "Payment could not be confirmed. Check Google Play before trying again."); return;
        }
        if (purchases != null) for (Purchase purchase : purchases) process(purchase);
    }
    private void process(Purchase purchase) {
        if (!purchase.getProducts().contains(PRODUCT)) return;
        if (purchase.getPurchaseState() == Purchase.PurchaseState.PENDING) { finish("pending"); return; }
        if (purchase.getPurchaseState() != Purchase.PurchaseState.PURCHASED) return;
        String token = purchase.getPurchaseToken();
        if (!consuming.add(token)) return;
        // No digital reward is granted. Consumption acknowledges the one-time contribution.
        billing.consumeAsync(ConsumeParams.newBuilder().setPurchaseToken(token).build(), (result, ignored) -> {
            consuming.remove(token);
            if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                getReactApplicationContext().getSharedPreferences("readflow-support", 0)
                    .edit().putLong("lastSupport", System.currentTimeMillis()).apply();
                finish("purchased");
            } else {
                fail("processing", "Payment was received but is still processing. Do not pay again; Google Play will be checked next time you open readFlow.");
            }
        });
    }
    private void recoverPurchases() {
        billing.queryPurchasesAsync(QueryPurchasesParams.newBuilder()
            .setProductType(BillingClient.ProductType.INAPP).build(), (result, purchases) -> {
                if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    for (Purchase purchase : purchases) process(purchase);
                }
            });
    }
    @ReactMethod public void lastSupport(Promise promise) {
        promise.resolve((double) getReactApplicationContext().getSharedPreferences("readflow-support", 0)
            .getLong("lastSupport", 0));
    }
    @ReactMethod public void recover(Promise promise) {
        connected(() -> { if (billing.isReady()) recoverPurchases(); promise.resolve(null); });
    }
    @Override public void onHostResume() {
        connected(() -> { if (billing.isReady() && purchasePromise == null) recoverPurchases(); });
    }
    @Override public void onHostPause() {}
    @Override public void onHostDestroy() {}
    @Override public void invalidate() {
        getReactApplicationContext().removeLifecycleEventListener(this);
        handler.removeCallbacks(connectionTimeout);
        billing.endConnection();
        ready.clear();
        fail("closed", "Payment session closed. Check Google Play for its status.");
        super.invalidate();
    }
}
