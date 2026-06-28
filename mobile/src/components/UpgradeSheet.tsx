import React, { useState } from "react";
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { theme } from "../theme";

/**
 * In-app upgrade notice / paywall shown to free users when they tap a locked
 * feature (AI, OCR, cloud voice, export, or the free reading cap).
 *
 * Pricing model B — monthly base plan + annual plan shown as a monthly
 * equivalent, with a clear "Billed yearly" disclosure. These mirror the
 * canonical tiers in backend/src/config/plans.ts.
 *
 * Purchases go through Google Play Billing / RevenueCat *inside the app* — we
 * never route payment to a website or the store listing. Until that flow is
 * wired (purchasingAvailable=false) the primary CTA reads "Coming soon" rather
 * than presenting a fake payment button.
 */

type Billing = "monthly" | "annual";

interface Plan {
  key: string;
  name: string;
  tagline: string;
  recommended?: boolean;
  monthly: number;
  annualPerMonth: number;
  annualTotal: number;
  perks: string[];
}

const PLANS: Plan[] = [
  {
    key: "reader_plus",
    name: "Reader Plus",
    tagline: "Ad-free reading and scanned-PDF OCR.",
    monthly: 4.99,
    annualPerMonth: 3.33,
    annualTotal: 39.99,
    perks: ["Ad-free reading", "Scanned-PDF OCR — 300 pages / month", "Unlimited library"],
  },
  {
    key: "ai_pro",
    name: "AI Pro",
    tagline: "Summaries, explanations and Q&A on any PDF.",
    recommended: true,
    monthly: 9.99,
    annualPerMonth: 6.67,
    annualTotal: 79.99,
    perks: [
      "Everything in Reader Plus",
      "AI summaries, explain & Q&A — 500 / month",
      "OCR — 1,000 pages / month",
    ],
  },
  {
    key: "power",
    name: "Power",
    tagline: "High limits, export and batch tools.",
    monthly: 19.99,
    annualPerMonth: 12.5,
    annualTotal: 149.99,
    perks: [
      "Everything in AI Pro",
      "Export notes & summaries",
      "Highest limits — 3,000 OCR / 2,000 AI a month",
    ],
  },
];

const LEARN_MORE_URL = "https://urmiaworks.com/readflow";

function money(n: number): string {
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
}

interface Props {
  visible: boolean;
  /** Why the sheet appeared, e.g. "AI is paid". */
  reasonTitle?: string;
  reasonBody?: string;
  onClose: () => void;
  /** Flip to true once Play Billing / RevenueCat purchases are wired. */
  purchasingAvailable?: boolean;
}

export function UpgradeSheet({
  visible,
  reasonTitle,
  reasonBody,
  onClose,
  purchasingAvailable = false,
}: Props) {
  const [billing, setBilling] = useState<Billing>("annual");
  const [selected, setSelected] = useState<string>("ai_pro");

  const plan = PLANS.find((p) => p.key === selected) ?? PLANS[1];

  const onPrimary = () => {
    // When purchases are live this opens the native subscription flow for the
    // selected plan + billing period. Until then we never show a fake button.
    if (!purchasingAvailable) return;
  };

  const openLearnMore = () => {
    Linking.openURL(LEARN_MORE_URL).catch(() => {});
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {/* header */}
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <View style={styles.mark}>
                <View style={styles.markSpine} />
                <Text style={styles.markText}>
                  r<Text style={styles.markTextItalic}>F</Text>
                </Text>
              </View>
              <Text style={styles.eyebrow}>READFLOW PLUS</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>

          <Text style={styles.title}>{reasonTitle || "Unlock more of ReadFlow"}</Text>
          <Text style={styles.body}>
            {reasonBody ||
              "Upgrade to read every document with no limits, OCR your scanned PDFs, and ask AI about anything you’re reading."}
          </Text>

          {/* billing toggle */}
          <View style={styles.toggle}>
            <Pressable
              style={[styles.toggleBtn, billing === "monthly" && styles.toggleBtnActive]}
              onPress={() => setBilling("monthly")}
            >
              <Text
                style={[styles.toggleText, billing === "monthly" && styles.toggleTextActive]}
              >
                Monthly
              </Text>
            </Pressable>
            <Pressable
              style={[styles.toggleBtn, billing === "annual" && styles.toggleBtnActive]}
              onPress={() => setBilling("annual")}
            >
              <Text style={[styles.toggleText, billing === "annual" && styles.toggleTextActive]}>
                Annual
              </Text>
              <Text style={[styles.toggleHint, billing === "annual" && styles.toggleHintActive]}>
                save up to 38%
              </Text>
            </Pressable>
          </View>

          {/* plan cards */}
          <ScrollView style={styles.cards} contentContainerStyle={styles.cardsContent}>
            {PLANS.map((p) => {
              const isSel = p.key === selected;
              const perMonth = billing === "annual" ? p.annualPerMonth : p.monthly;
              return (
                <Pressable
                  key={p.key}
                  style={[styles.card, isSel && styles.cardSel, p.recommended && styles.cardRec]}
                  onPress={() => setSelected(p.key)}
                >
                  <View style={styles.cardTop}>
                    <Text style={styles.cardName}>{p.name}</Text>
                    {p.recommended ? (
                      <Text style={styles.recBadge}>RECOMMENDED</Text>
                    ) : null}
                  </View>
                  <Text style={styles.cardTagline}>{p.tagline}</Text>

                  <View style={styles.priceRow}>
                    <Text style={styles.price}>{money(perMonth)}</Text>
                    <Text style={styles.priceUnit}>/ month</Text>
                  </View>
                  <Text style={styles.priceSub}>
                    {billing === "annual"
                      ? `Billed yearly at ${money(p.annualTotal)}/year`
                      : "Billed monthly"}
                  </Text>

                  <View style={styles.perks}>
                    {p.perks.map((perk) => (
                      <View key={perk} style={styles.perkRow}>
                        <Text style={styles.perkTick}>✓</Text>
                        <Text style={styles.perkText}>{perk}</Text>
                      </View>
                    ))}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* primary CTA */}
          <Pressable
            style={[styles.cta, !purchasingAvailable && styles.ctaDisabled]}
            onPress={onPrimary}
            disabled={!purchasingAvailable}
          >
            <Text style={styles.ctaText}>
              {purchasingAvailable ? `Upgrade to ${plan.name}` : "Coming soon"}
            </Text>
          </Pressable>
          {!purchasingAvailable ? (
            <Text style={styles.ctaNote}>
              In-app subscriptions launch soon — no charge yet.
            </Text>
          ) : (
            <Text style={styles.ctaNote}>
              {billing === "annual"
                ? `${money(plan.annualTotal)}/year · auto-renews · manage in Google Play`
                : `${money(plan.monthly)}/month · auto-renews · manage in Google Play`}
            </Text>
          )}

          {/* secondary actions */}
          <View style={styles.footer}>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={styles.maybeLater}>Maybe later</Text>
            </Pressable>
            <Text style={styles.footerDot}>·</Text>
            <Pressable onPress={openLearnMore} hitSlop={8}>
              <Text style={styles.learnMore}>Learn more</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(20,17,11,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: theme.spacing(2.5),
    paddingTop: theme.spacing(2.5),
    paddingBottom: theme.spacing(3),
    maxHeight: "92%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  mark: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: theme.colors.ink,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  markSpine: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
    backgroundColor: theme.colors.accent,
  },
  markText: {
    color: "#F4ECD6",
    fontFamily: theme.fonts.serifSemiBold,
    fontSize: 15,
    marginLeft: 4,
  },
  markTextItalic: { fontFamily: theme.fonts.serifItalic },
  eyebrow: {
    color: theme.colors.accent,
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: 11,
    letterSpacing: 1.4,
  },
  close: { color: theme.colors.textDim, fontSize: 18, paddingHorizontal: 4 },
  title: {
    color: theme.colors.text,
    fontFamily: theme.fonts.serifSemiBold,
    fontSize: 23,
    marginTop: theme.spacing(2),
  },
  body: {
    color: theme.colors.textMute,
    fontFamily: theme.fonts.sans,
    fontSize: 14.5,
    lineHeight: 21,
    marginTop: theme.spacing(1),
  },
  toggle: {
    flexDirection: "row",
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: 14,
    padding: 4,
    marginTop: theme.spacing(2),
  },
  toggleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 11,
  },
  toggleBtnActive: {
    backgroundColor: theme.colors.surface,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  toggleText: { color: theme.colors.textMute, fontFamily: theme.fonts.sansSemiBold, fontSize: 14 },
  toggleTextActive: { color: theme.colors.text },
  toggleHint: { color: theme.colors.textDim, fontFamily: theme.fonts.sansMedium, fontSize: 11 },
  toggleHintActive: { color: theme.colors.accent },
  cards: { marginTop: theme.spacing(2) },
  cardsContent: { gap: 12, paddingBottom: 4 },
  card: {
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 18,
    padding: theme.spacing(2),
    backgroundColor: theme.colors.card,
  },
  cardSel: { borderColor: theme.colors.accent },
  cardRec: { backgroundColor: "#FCF6EA" },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardName: { color: theme.colors.text, fontFamily: theme.fonts.serifSemiBold, fontSize: 18 },
  recBadge: {
    color: theme.colors.accent,
    backgroundColor: theme.colors.accentSoft,
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: 10,
    letterSpacing: 0.8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: "hidden",
  },
  cardTagline: {
    color: theme.colors.textMute,
    fontFamily: theme.fonts.sans,
    fontSize: 13,
    marginTop: 3,
  },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 5, marginTop: theme.spacing(1.5) },
  price: { color: theme.colors.text, fontFamily: theme.fonts.serifSemiBold, fontSize: 28 },
  priceUnit: { color: theme.colors.textDim, fontFamily: theme.fonts.sans, fontSize: 13 },
  priceSub: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.sansMedium,
    fontSize: 11.5,
    marginTop: 2,
  },
  perks: { marginTop: theme.spacing(1.5), gap: 8 },
  perkRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  perkTick: { color: theme.colors.accent, fontFamily: theme.fonts.sansBold, fontSize: 13 },
  perkText: { flex: 1, color: theme.colors.body, fontFamily: theme.fonts.sans, fontSize: 13.5 },
  cta: {
    height: 54,
    borderRadius: 16,
    backgroundColor: theme.colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginTop: theme.spacing(2),
  },
  ctaDisabled: { backgroundColor: theme.colors.accent, opacity: 0.55 },
  ctaText: { color: theme.colors.onAccent, fontFamily: theme.fonts.sansBold, fontSize: 16 },
  ctaNote: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
    textAlign: "center",
    marginTop: theme.spacing(1),
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: theme.spacing(1.5),
  },
  maybeLater: { color: theme.colors.textMute, fontFamily: theme.fonts.sansSemiBold, fontSize: 14 },
  footerDot: { color: theme.colors.textDim },
  learnMore: {
    color: theme.colors.textMute,
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: 14,
    textDecorationLine: "underline",
  },
});
