/* Customer-app strings. Languages are switched on/off by the Super Admin
 * (Settings → Languages); anything missing falls back to English. */

const en = {
  hello: "Hello", morning: "Good Morning", afternoon: "Good Afternoon", evening: "Good Evening",
  home: "Home", orders: "Orders", plans: "Plans", profile: "Profile",
  heroTitle: "Clean Water\nBetter Life", heroBody: "20L cans at your door in 30 minutes", orderNow: "Order now",
  qOrder: "Order Now", qSubscribe: "Subscribe", qOrders: "My Orders", qWallet: "Wallet",
  nearby: "Drivers near you", popular: "Popular Products", activeOrder: "Your order", track: "Track",
  notServiceable: "We don't deliver here yet", notServiceableBody: "Try another address — we're expanding across the city.",
  mySub: "My Subscription", support: "Need help?", call: "Call", whatsapp: "WhatsApp",
  deliverTo: "Deliver to", proceed: "Proceed to Pay", placeOrder: "Place Order",
};

export type StrKey = keyof typeof en;

const hi: Partial<Record<StrKey, string>> = {
  hello: "नमस्ते", morning: "सुप्रभात", afternoon: "शुभ दोपहर", evening: "शुभ संध्या",
  home: "होम", orders: "ऑर्डर", plans: "प्लान", profile: "प्रोफ़ाइल",
  heroTitle: "साफ़ पानी\nबेहतर जीवन", heroBody: "20 लीटर कैन 30 मिनट में आपके दरवाज़े पर", orderNow: "अभी ऑर्डर करें",
  qOrder: "ऑर्डर करें", qSubscribe: "सब्सक्राइब", qOrders: "मेरे ऑर्डर", qWallet: "वॉलेट",
  nearby: "आपके पास ड्राइवर", popular: "लोकप्रिय उत्पाद", activeOrder: "आपका ऑर्डर", track: "ट्रैक करें",
  notServiceable: "यहाँ अभी डिलीवरी नहीं है", notServiceableBody: "कोई दूसरा पता चुनें — हम पूरे शहर में बढ़ रहे हैं।",
  mySub: "मेरा सब्सक्रिप्शन", support: "मदद चाहिए?", call: "कॉल", whatsapp: "व्हाट्सऐप",
  deliverTo: "डिलीवरी पता", proceed: "भुगतान करें", placeOrder: "ऑर्डर करें",
};

const DICTS: Record<string, Partial<Record<StrKey, string>>> = { en, hi };

export function t(lang: string, key: StrKey) {
  return DICTS[lang]?.[key] ?? en[key];
}

export function greeting(lang: string, hour = new Date().getHours()) {
  return t(lang, hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening");
}
