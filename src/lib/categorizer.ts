import { prisma } from "@/lib/prisma";
import { RuleSource } from "@/generated/prisma";

interface CategorizationResult {
  categoryId: string;
  confidence: number;
  source: string;
}

interface DefaultCategory {
  name: string;
  icon: string;
  color: string;
  children?: { name: string; icon: string; color: string }[];
}

const KEYWORD_CATEGORY_MAP: Record<string, string[]> = {
  "Food & Dining": [
    "restaurant",
    "food",
    "dining",
    "cafe",
    "coffee",
    "pizza",
    "burger",
    "biryani",
    "swiggy",
    "zomato",
    "dominos",
    "mcdonalds",
    "starbucks",
    "dunkin",
  ],
  Groceries: [
    "grocery",
    "supermarket",
    "bigbasket",
    "blinkit",
    "zepto",
    "dmart",
    "reliance fresh",
    "more supermarket",
    "instamart",
  ],
  Transportation: [
    "uber",
    "ola",
    "rapido",
    "metro",
    "fuel",
    "petrol",
    "diesel",
    "parking",
    "toll",
    "irctc",
    "railway",
    "flight",
    "airline",
    "cab",
    "taxi",
  ],
  Shopping: [
    "amazon",
    "flipkart",
    "myntra",
    "ajio",
    "nykaa",
    "meesho",
    "snapdeal",
    "mall",
    "store",
  ],
  Entertainment: [
    "netflix",
    "hotstar",
    "prime video",
    "spotify",
    "youtube",
    "movie",
    "cinema",
    "bookmyshow",
    "gaming",
    "steam",
  ],
  "Bills & Utilities": [
    "electricity",
    "water",
    "gas",
    "internet",
    "broadband",
    "jio",
    "airtel",
    "vi",
    "bsnl",
    "mobile recharge",
    "dth",
    "tata play",
  ],
  "Health & Fitness": [
    "hospital",
    "doctor",
    "pharmacy",
    "medical",
    "gym",
    "apollo",
    "medplus",
    "1mg",
    "pharmeasy",
    "netmeds",
    "cult",
  ],
  Education: [
    "school",
    "college",
    "university",
    "course",
    "udemy",
    "coursera",
    "book",
    "tuition",
    "coaching",
  ],
  Housing: [
    "rent",
    "maintenance",
    "society",
    "housing",
    "property",
    "home loan",
    "mortgage",
  ],
  Insurance: [
    "insurance",
    "lic",
    "policy",
    "premium",
    "health insurance",
    "life insurance",
    "motor insurance",
  ],
  Investment: [
    "mutual fund",
    "sip",
    "stock",
    "share",
    "zerodha",
    "groww",
    "upstox",
    "angel",
    "investment",
    "fd",
    "fixed deposit",
  ],
  "Personal Care": [
    "salon",
    "spa",
    "beauty",
    "grooming",
    "haircut",
    "skincare",
  ],
  Travel: [
    "hotel",
    "booking",
    "makemytrip",
    "goibibo",
    "oyo",
    "airbnb",
    "travel",
    "trip",
    "vacation",
  ],
  Subscriptions: [
    "subscription",
    "membership",
    "premium",
    "annual plan",
    "monthly plan",
  ],
};

export function getDefaultCategories(): DefaultCategory[] {
  return [
    {
      name: "Food & Dining",
      icon: "🍽️",
      color: "#FF6B6B",
      children: [
        { name: "Restaurants", icon: "🍕", color: "#FF8E8E" },
        { name: "Cafes & Coffee", icon: "☕", color: "#FFB4B4" },
        { name: "Food Delivery", icon: "🛵", color: "#FF9999" },
        { name: "Bars & Drinks", icon: "🍺", color: "#FFAAAA" },
      ],
    },
    {
      name: "Groceries",
      icon: "🛒",
      color: "#4ECDC4",
      children: [
        { name: "Supermarket", icon: "🏪", color: "#6EDDD5" },
        { name: "Online Grocery", icon: "📦", color: "#8EEDE6" },
        { name: "Vegetables & Fruits", icon: "🥬", color: "#AEFDF7" },
      ],
    },
    { name: "Housing", icon: "🏠", color: "#45B7D1", children: [
      { name: "Rent", icon: "🔑", color: "#65C7E1" },
      { name: "Maintenance", icon: "🔧", color: "#85D7F1" },
      { name: "Home Loan EMI", icon: "🏦", color: "#A5E7FF" },
    ]},
    { name: "Transportation", icon: "🚗", color: "#96CEB4", children: [
      { name: "Fuel", icon: "⛽", color: "#A6DEBA" },
      { name: "Public Transport", icon: "🚌", color: "#B6EEC4" },
      { name: "Cabs & Rides", icon: "🚕", color: "#C6FECE" },
      { name: "Parking & Tolls", icon: "🅿️", color: "#D6FFD8" },
    ]},
    { name: "Shopping", icon: "🛍️", color: "#FFEAA7" },
    { name: "Entertainment", icon: "🎬", color: "#DDA0DD" },
    { name: "Bills & Utilities", icon: "💡", color: "#98D8C8" },
    { name: "Health & Fitness", icon: "💊", color: "#F7DC6F" },
    { name: "Education", icon: "📚", color: "#85C1E9" },
    { name: "Insurance", icon: "🛡️", color: "#82E0AA" },
    { name: "Investment", icon: "📈", color: "#F0B27A" },
    { name: "Personal Care", icon: "💇", color: "#D2B4DE" },
    { name: "Travel", icon: "✈️", color: "#AED6F1" },
    { name: "Subscriptions", icon: "🔄", color: "#F5B7B1" },
    { name: "Gifts & Donations", icon: "🎁", color: "#FADBD8" },
    { name: "Salary", icon: "💰", color: "#A9DFBF" },
    { name: "Freelance Income", icon: "💼", color: "#A3E4D7" },
    { name: "Refunds", icon: "↩️", color: "#AED6F1" },
    { name: "Transfers", icon: "🔄", color: "#D5DBDB" },
    { name: "ATM Withdrawal", icon: "🏧", color: "#F9E79F" },
    { name: "Fees & Charges", icon: "📋", color: "#F5CBA7" },
    { name: "Other", icon: "📌", color: "#D5DBDB" },
  ];
}

export async function seedDefaultCategories(userId: string): Promise<void> {
  const existing = await prisma.category.findFirst({
    where: { userId },
  });

  if (existing) return;

  const categories = getDefaultCategories();

  for (let i = 0; i < categories.length; i++) {
    const cat = categories[i];
    const parent = await prisma.category.create({
      data: {
        userId,
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        isSystem: true,
        sortOrder: i,
      },
    });

    if (cat.children) {
      for (let j = 0; j < cat.children.length; j++) {
        const child = cat.children[j];
        await prisma.category.create({
          data: {
            userId,
            name: child.name,
            icon: child.icon,
            color: child.color,
            parentId: parent.id,
            isSystem: true,
            sortOrder: j,
          },
        });
      }
    }
  }
}

export async function categorizeTransaction(
  userId: string,
  merchantName: string,
  description: string,
  type: string,
  _amount: number
): Promise<CategorizationResult> {
  // 1) User rules for this merchant
  if (merchantName) {
    const userRule = await prisma.categoryRule.findFirst({
      where: {
        userId,
        source: RuleSource.USER,
        merchant: {
          normalizedName: merchantName.toLowerCase(),
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    if (userRule) {
      await prisma.categoryRule.update({
        where: { id: userRule.id },
        data: { applyCount: { increment: 1 } },
      });
      return {
        categoryId: userRule.categoryId,
        confidence: userRule.confidence,
        source: "user_rule",
      };
    }
  }

  // 2) Learned merchant rules
  if (merchantName) {
    const learnedRule = await prisma.categoryRule.findFirst({
      where: {
        userId,
        source: RuleSource.LEARNED,
        merchant: {
          normalizedName: merchantName.toLowerCase(),
        },
      },
      orderBy: { applyCount: "desc" },
    });

    if (learnedRule) {
      await prisma.categoryRule.update({
        where: { id: learnedRule.id },
        data: { applyCount: { increment: 1 } },
      });
      return {
        categoryId: learnedRule.categoryId,
        confidence: learnedRule.confidence,
        source: "learned_rule",
      };
    }
  }

  // 3) Keyword-based rules
  const searchText = `${merchantName} ${description}`.toLowerCase();

  for (const [categoryName, keywords] of Object.entries(KEYWORD_CATEGORY_MAP)) {
    if (keywords.some((kw) => searchText.includes(kw))) {
      const category = await prisma.category.findFirst({
        where: {
          userId,
          name: categoryName,
          parentId: null,
        },
      });

      if (category) {
        return {
          categoryId: category.id,
          confidence: 0.6,
          source: "keyword",
        };
      }
    }
  }

  // 4) Default - try to find "Other" category
  const defaultCategory = await prisma.category.findFirst({
    where: {
      userId,
      name: "Other",
      parentId: null,
    },
  });

  if (defaultCategory) {
    return {
      categoryId: defaultCategory.id,
      confidence: 0.1,
      source: "default",
    };
  }

  // Seed categories if none exist and retry
  await seedDefaultCategories(userId);
  const other = await prisma.category.findFirst({
    where: { userId, name: "Other", parentId: null },
  });

  return {
    categoryId: other?.id ?? "",
    confidence: 0.1,
    source: "default",
  };
}

export async function learnFromUserChoice(
  userId: string,
  merchantId: string,
  categoryId: string
): Promise<void> {
  const existing = await prisma.categoryRule.findFirst({
    where: {
      userId,
      merchantId,
      source: RuleSource.LEARNED,
    },
  });

  if (existing) {
    await prisma.categoryRule.update({
      where: { id: existing.id },
      data: {
        categoryId,
        applyCount: { increment: 1 },
        confidence: Math.min(1, existing.confidence + 0.05),
      },
    });
  } else {
    await prisma.categoryRule.create({
      data: {
        userId,
        merchantId,
        categoryId,
        source: RuleSource.LEARNED,
        confidence: 0.7,
        applyCount: 1,
      },
    });
  }
}
