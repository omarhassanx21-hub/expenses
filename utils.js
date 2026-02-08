import { Timestamp } from "./firebase.js";

export function detectCategory(description) {
  const desc = description.toLowerCase();
  // Helper for whole word matching (prevents "car" matching "card")
  const hasWord = (word) => new RegExp(`\\b${word}\\b`, "i").test(desc);

  // Income
  if (
    desc.includes("salary") ||
    desc.includes("income") ||
    desc.includes("deposit") ||
    desc.includes("freelance") ||
    desc.includes("dividend") ||
    desc.includes("interest") ||
    desc.includes("refund")
  )
    return "Income";

  // Housing
  if (
    desc.includes("rent") ||
    desc.includes("mortgage") ||
    desc.includes("house") ||
    desc.includes("apartment") ||
    desc.includes("maintenance") ||
    desc.includes("furniture") ||
    desc.includes("decor") ||
    desc.includes("plumber") ||
    desc.includes("electrician")
  )
    return "Housing";

  // Transport
  if (
    desc.includes("uber") ||
    desc.includes("taxi") ||
    desc.includes("bolt") ||
    desc.includes("lyft") ||
    hasWord("bus") ||
    desc.includes("train") ||
    desc.includes("metro") ||
    desc.includes("flight") ||
    desc.includes("plane") ||
    desc.includes("fuel") ||
    desc.includes("gas") ||
    desc.includes("parking") ||
    hasWord("car") ||
    desc.includes("mechanic") ||
    desc.includes("service") ||
    desc.includes("motor") ||
    desc.includes("bike") ||
    desc.includes("oil") ||
    desc.includes("tire") ||
    desc.includes("dolab") ||
    desc.includes("brake") ||
    desc.includes("wheel") ||
    desc.includes("fix") ||
    desc.includes("airport") ||
    desc.includes("keys")
  )
    return "Transport";

  // Utilities
  if (
    desc.includes("bill") ||
    desc.includes("internet") ||
    desc.includes("electricity") ||
    desc.includes("water") ||
    desc.includes("phone") ||
    desc.includes("mobile") ||
    desc.includes("wifi") ||
    desc.includes("recharge") ||
    desc.includes("alfa") ||
    desc.includes("mtc") ||
    desc.includes("touch") ||
    desc.includes("ogero") ||
    desc.includes("subscription") ||
    hasWord("sim")
  )
    return "Utilities";

  // Health
  if (
    desc.includes("doctor") ||
    desc.includes("pharmacy") ||
    desc.includes("gym") ||
    desc.includes("fitness") ||
    desc.includes("workout") ||
    desc.includes("protein") ||
    desc.includes("supplement") ||
    desc.includes("med") ||
    hasWord("medicine") ||
    desc.includes("pill") ||
    desc.includes("hospital") ||
    desc.includes("dentist") ||
    desc.includes("clinic") ||
    desc.includes("test") ||
    desc.includes("blood") ||
    desc.includes("xray")
  )
    return "Health";

  // Education
  if (
    desc.includes("coursera") ||
    desc.includes("udemy") ||
    desc.includes("school") ||
    desc.includes("university") ||
    desc.includes("college") ||
    desc.includes("course") ||
    desc.includes("book") ||
    desc.includes("paper") ||
    hasWord("pen") ||
    desc.includes("pencil") ||
    desc.includes("stationery") ||
    desc.includes("tuition")
  )
    return "Education";

  // Entertainment
  if (
    desc.includes("movie") ||
    desc.includes("cinema") ||
    desc.includes("game") ||
    desc.includes("steam") ||
    desc.includes("playstation") ||
    desc.includes("xbox") ||
    desc.includes("nintendo") ||
    desc.includes("netflix") ||
    desc.includes("spotify") ||
    desc.includes("music") ||
    desc.includes("concert") ||
    desc.includes("event") ||
    desc.includes("ticket") ||
    desc.includes("youtube") ||
    desc.includes("hulu") ||
    desc.includes("disney") ||
    desc.includes("argile") ||
    desc.includes("shisha") ||
    desc.includes("hookah") ||
    desc.includes("bowling") ||
    desc.includes("party") ||
    desc.includes("nightclub") ||
    desc.includes("club") ||
    desc.includes("bar") ||
    desc.includes("pub") ||
    desc.includes("billiard") ||
    desc.includes("vape") ||
    desc.includes("smoke") ||
    desc.includes("cigar") ||
    desc.includes("cigarette") ||
    desc.includes("iqus") ||
    desc.includes("m3sl") ||
    desc.includes("shahid") ||
    desc.includes("itunes") ||
    hasWord("app") ||
    desc.includes("ps4") ||
    desc.includes("ps5")
  )
    return "Entertainment";

  // Food
  if (
    desc.includes("food") ||
    desc.includes("grocery") ||
    desc.includes("supermarket") ||
    desc.includes("market") ||
    desc.includes("spinneys") ||
    desc.includes("carrefour") ||
    desc.includes("lunch") ||
    desc.includes("dinner") ||
    desc.includes("coffee") ||
    desc.includes("burger") ||
    desc.includes("pizza") ||
    desc.includes("sushi") ||
    desc.includes("shawarma") ||
    desc.includes("taouk") ||
    desc.includes("sandwich") ||
    desc.includes("restaurant") ||
    desc.includes("delivery") ||
    desc.includes("toters") ||
    desc.includes("snack") ||
    desc.includes("drink") ||
    desc.includes("water") ||
    desc.includes("juice") ||
    desc.includes("soda") ||
    desc.includes("pepsi") ||
    desc.includes("coke") ||
    desc.includes("cocktail") ||
    desc.includes("starbucs") ||
    desc.includes("starbucks") ||
    desc.includes("breakfast") ||
    desc.includes("cake") ||
    desc.includes("dessert") ||
    desc.includes("chocolate") ||
    desc.includes("ice cream") ||
    desc.includes("donut") ||
    desc.includes("dkan") ||
    desc.includes("cafe")
  )
    return "Food";

  // Shopping
  if (
    desc.includes("amazon") ||
    desc.includes("aliexpress") ||
    desc.includes("shein") ||
    desc.includes("zara") ||
    desc.includes("h&m") ||
    desc.includes("nike") ||
    desc.includes("adidas") ||
    desc.includes("shop") ||
    desc.includes("store") ||
    desc.includes("mall") ||
    desc.includes("clothes") ||
    desc.includes("backpack") ||
    desc.includes("charger") ||
    desc.includes("macbook") ||
    desc.includes("iphone") ||
    desc.includes("samsung") ||
    desc.includes("phone") ||
    desc.includes("electronics") ||
    desc.includes("airtag") ||
    desc.includes("cap") ||
    desc.includes("wallet") ||
    desc.includes("shoe") ||
    desc.includes("tshirt") ||
    desc.includes("shirt") ||
    desc.includes("pants") ||
    desc.includes("jeans") ||
    desc.includes("suit") ||
    desc.includes("pajama") ||
    desc.includes("bag") ||
    desc.includes("hair") ||
    desc.includes("cut") ||
    desc.includes("barber") ||
    desc.includes("salon") ||
    desc.includes("shampoo") ||
    desc.includes("shave") ||
    desc.includes("tooth") ||
    desc.includes("soap") ||
    desc.includes("cream") ||
    desc.includes("perfume") ||
    desc.includes("cologne") ||
    desc.includes("makeup") ||
    desc.includes("deodorant")
  )
    return "Shopping";

  // Personal
  if (
    desc.includes("gift") ||
    desc.includes("donation") ||
    desc.includes("charity") ||
    desc.includes("family") ||
    desc.includes("mom") ||
    desc.includes("dad") ||
    desc.includes("brother") ||
    desc.includes("sister") ||
    desc.includes("friend") ||
    desc.includes("debt") ||
    desc.includes("loan") ||
    desc.includes("borrow") ||
    desc.includes("lend") ||
    desc.includes("lent") ||
    desc.includes("repay") ||
    desc.includes("owe") ||
    desc.includes("crypto") ||
    desc.includes("bitcoin") ||
    desc.includes("usdt") ||
    desc.includes("binance") ||
    desc.includes("trading") ||
    desc.includes("stock") ||
    desc.includes("invest") ||
    desc.includes("allowence") ||
    desc.includes("paid back") ||
    desc.includes("reimburse") ||
    desc.includes("settle") ||
    desc.includes("repaid") ||
    desc.includes("paid me back")
  )
    return "Personal";

  return "General";
}

export function extractPersonName(description) {
  const lower = description.toLowerCase();
  const ignore = [
    "lent",
    "lend",
    "loan",
    "borrow",
    "borrowed",
    "from",
    "to",
    "repay",
    "repaid",
    "paid",
    "pay",
    "back",
    "return",
    "returned",
    "debt",
    "settle",
    "settled",
    "advance",
    "cover",
    "spot",
    "money",
    "cash",
    "transfer",
    "sent",
    "received",
    "get",
    "got",
    "of",
    "for",
    "the",
    "a",
    "an",
    "in",
    "with",
    "via",
    "by",
    "me",
    "my",
    "i",
    "him",
    "her",
    "it",
    "them",
    "us",
    "we",
    "yesterday",
    "today",
    "tomorrow",
    "last",
    "week",
    "month",
    "year",
    "dollar",
    "usd",
    "lbp",
    "euro",
    "amount",
    "lunch",
    "dinner",
    "breakfast",
    "coffee",
    "food",
    "drink",
    "drinks",
    "uber",
    "taxi",
    "ticket",
    "movie",
    "bill",
    "rent",
    "subscription",
    "income",
    "spotify",
    "netflix",
    "youtube",
    "prime",
    "apple",
  ];

  let clean = lower.replace(/[0-9$€£¥]/g, " ").trim();
  const words = clean
    .split(/\s+/)
    .filter((w) => w.length > 1 && !ignore.includes(w));

  if (words.length === 0) return "Unknown";
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export function parseTransactionString(text) {
  let desc = text.trim();
  let amount = 0;
  let date = new Date();

  const dateRegex = /(\d{1,2})[\/\-\.](\d{1,2})(?:[\/\-\.](\d{2,4}))?/;
  const dateMatch = desc.match(dateRegex);

  if (dateMatch) {
    const year = dateMatch[3]
      ? dateMatch[3].length === 2
        ? "20" + dateMatch[3]
        : dateMatch[3]
      : new Date().getFullYear();
    date = new Date(year, dateMatch[2] - 1, dateMatch[1]);
    desc = desc.replace(dateMatch[0], "").trim();
  } else {
    const lower = desc.toLowerCase();
    if (lower.includes("yesterday")) {
      date.setDate(date.getDate() - 1);
      desc = desc.replace(/yesterday/i, "").trim();
    } else if (lower.includes("today")) {
      desc = desc.replace(/today/i, "").trim();
    }
  }

  const amountMatch = desc.match(/[\$€£¥]?\s*(\d+(?:\.\d{1,2})?)\s*[\$€£¥]?/);
  if (amountMatch) {
    amount = parseFloat(amountMatch[1]);
    desc = desc.replace(amountMatch[0], "").trim();
  }

  desc = desc.replace(/\s+/g, " ").trim();
  if (!desc) desc = "Unknown Transaction";

  const lowerDesc = desc.toLowerCase();
  let isIncome =
    lowerDesc.includes("income") ||
    lowerDesc.includes("salary") ||
    lowerDesc.includes("deposit");

  if (
    lowerDesc.includes("borrow") &&
    !lowerDesc.includes("repay") &&
    !lowerDesc.includes("paid")
  ) {
    isIncome = true;
  }
  if (
    lowerDesc.includes("paid me back") ||
    lowerDesc.includes("repaid me") ||
    (lowerDesc.includes("returned") && lowerDesc.includes("me"))
  ) {
    isIncome = true;
  }

  const category = detectCategory(desc);

  // Fix: Don't overwrite Personal category with Income if it's a debt transaction
  let finalCategory = category;
  if (isIncome && category !== "Personal") {
    finalCategory = "Income";
  }

  return {
    amount,
    description: desc,
    category: finalCategory,
    type: isIncome ? "income" : "expense",
    date: Timestamp.fromDate(date),
    createdAt: Timestamp.now(),
  };
}

export function parseBulkText(text) {
  const lines = text.split("\n").filter((line) => line.trim() !== "");
  const results = [];
  lines.forEach((line) => {
    const parsed = parseTransactionString(line);
    if (parsed.amount > 0) results.push(parsed);
  });
  return results;
}
