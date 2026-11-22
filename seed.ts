import "dotenv/config";
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI || "";
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || undefined;

const SEED_SERVICES = [
  {
    _id: new mongoose.Types.ObjectId("6affe4dc572bdc6f661995e9"),
    vendorId: new mongoose.Types.ObjectId("65f1a2b3c4d5e6f7a8b9c001"),
    vendorName: "Aarav Sen",
    businessName: "Keepsake Lens Studio",
    serviceName: "Golden Hour Film & Editorial Portraits",
    category: "Photography & Cinematography",
    description:
      "Full-day candid storytelling, 35mm-inspired portraits, and cinema highlight reels crafted for intimate ceremonies and grand receptions.",
    price: 45000,
    location: "Dhaka",
    images: [
      "https://i.pinimg.com/736x/9a/d1/2e/9ad12ef8b109c9bb815f613a61bb2542.jpg",
      "https://i.pinimg.com/1200x/57/9d/26/579d267926b54eb3bd0909ceaeba210e.jpg",
    ],
    status: "approved",
    isActive: true,
    createdAt: new Date("2026-11-20T06:12:44.570+00:00"),
    updatedAt: new Date("2026-11-20T06:12:44.570+00:00"),
  },
  {
    _id: new mongoose.Types.ObjectId("6affe4dc572bdc6f661995ea"),
    vendorId: new mongoose.Types.ObjectId("65f1a2b3c4d5e6f7a8b9c002"),
    vendorName: "Nadia Rahman",
    businessName: "Rosewood Estates",
    serviceName: "Rosewood Courtyard & Banquet Hall",
    category: "Wedding Planner & Event",
    description:
      "Sunlit courtyard lawn paired with an indoor heritage house, bridal suite access, ambient lighting, and dedicated event staff.",
    price: 165000,
    location: "Sylhet",
    images: [
      "https://i.pinimg.com/1200x/04/08/d8/0408d8f37d101ac7b8ca4888f5105c85.jpg",
      "https://i.pinimg.com/736x/46/da/83/46da83568f820b856a08d88e7b1809a6.jpg",
    ],
    status: "approved",
    isActive: true,
    createdAt: new Date("2026-11-20T06:12:44.571+00:00"),
    updatedAt: new Date("2026-11-20T06:12:44.571+00:00"),
  },
  {
    _id: new mongoose.Types.ObjectId("6affe4dc572bdc6f661995eb"),
    vendorId: new mongoose.Types.ObjectId("65f1a2b3c4d5e6f7a8b9c003"),
    vendorName: "Rohan Chowdhury",
    businessName: "Petals & Brass Co.",
    serviceName: "Peony & Brass Mandap Atelier",
    category: "Stage & Venue Decor",
    description:
      "Bespoke stage styling, fresh floral arrangements, brass accents, and warm aisle lanterns tailored to your palette.",
    price: 62000,
    location: "Chattogram",
    images: [
      "https://i.pinimg.com/1200x/d0/87/d0/d087d0dbd027044244ce4b4379d85cb8.jpg",
      "https://i.pinimg.com/1200x/9a/bd/3b/9abd3bde805f25287d53e6199f2bdcda.jpg",
    ],
    status: "approved",
    isActive: true,
    createdAt: new Date("2026-11-20T06:12:44.571+00:00"),
    updatedAt: new Date("2026-11-20T06:12:44.571+00:00"),
  },
  {
    _id: new mongoose.Types.ObjectId("6affe4dc572bdc6f661995ec"),
    vendorId: new mongoose.Types.ObjectId("65f1a2b3c4d5e6f7a8b9c004"),
    vendorName: "Tariq Mahmud",
    businessName: "Dastarkhwan Heritage Kitchen",
    serviceName: "Saffron & Cardamom Wedding Feast",
    category: "Catering & Desserts",
    description:
      "Curated multi-course wedding menu featuring aromatic biryanis, live kebabs, artisanal desserts, and attentive hospitality.",
    price: 88000,
    location: "Dhaka",
    images: [
      "https://i.pinimg.com/736x/27/d5/b7/27d5b75ce35af092d344641e19a9eae1.jpg",
      "https://i.pinimg.com/736x/80/1b/83/801b8334c957fa3e27f174b2f9cdfabc.jpg",
    ],
    status: "approved",
    isActive: true,
    createdAt: new Date("2026-11-20T06:12:44.571+00:00"),
    updatedAt: new Date("2026-11-20T06:12:44.571+00:00"),
  },
  {
    _id: new mongoose.Types.ObjectId("6affe4dc572bdc6f661995ed"),
    vendorId: new mongoose.Types.ObjectId("65f1a2b3c4d5e6f7a8b9c005"),
    vendorName: "Mahira Islam",
    businessName: "Atelier Lumiere",
    serviceName: "Velvet & Dew Bridal Atelier",
    category: "Bridal Makeup & Styling",
    description:
      "Luminous skin-first bridal makeup, editorial hair styling, and pre-event skin prep with trial session and touch-up kit.",
    price: 24000,
    location: "Rajshahi",
    images: [
      "https://i.pinimg.com/736x/34/50/a8/3450a8a949b6dd63d70d68e19ded1bc9.jpg",
      "https://i.pinimg.com/1200x/eb/f5/41/ebf54192203ce282c6bf2312ecf77216.jpg",
    ],
    status: "approved",
    isActive: true,
    createdAt: new Date("2026-11-20T06:12:44.571+00:00"),
    updatedAt: new Date("2026-11-20T06:12:44.571+00:00"),
  },
  {
    _id: new mongoose.Types.ObjectId("6affe4dc572bdc6f661995ee"),
    vendorId: new mongoose.Types.ObjectId("65f1a2b3c4d5e6f7a8b9c006"),
    vendorName: "Zayan Kabir",
    businessName: "Zari & Loom House",
    serviceName: "Heirloom Saree Draping & Bridal Edit",
    category: "Bridal Wear & Attire",
    description:
      "Bespoke bridal saree draping, hand-embellished bridal wear, and coordinating groom ensembles crafted with custom tailoring.",
    price: 54000,
    location: "Dhaka",
    images: [
      "https://i.pinimg.com/1200x/1d/88/28/1d8828bf66c51a8aed26eac2325ac343.jpg",
    ],
    status: "approved",
    isActive: true,
    createdAt: new Date("2026-11-20T06:12:44.571+00:00"),
    updatedAt: new Date("2026-11-20T06:12:44.571+00:00"),
  },
  {
    _id: new mongoose.Types.ObjectId("6affe4dc572bdc6f661995ef"),
    vendorId: new mongoose.Types.ObjectId("65f1a2b3c4d5e6f7a8b9c002"),
    vendorName: "Nadia Rahman",
    businessName: "Rosewood Estates",
    serviceName: "Full-Day Wedding Coordination & Venue",
    category: "Wedding Planner & Event",
    description:
      "End-to-end timeline coordination, vendor scheduling, and sunlit courtyard and banquet space for seamless wedding celebrations.",
    price: 145000,
    location: "Rajshahi",
    images: [
      "https://i.pinimg.com/736x/46/da/83/46da83568f820b856a08d88e7b1809a6.jpg",
      "https://i.pinimg.com/1200x/04/08/d8/0408d8f37d101ac7b8ca4888f5105c85.jpg",
    ],
    status: "approved",
    isActive: true,
    createdAt: new Date("2026-11-20T06:12:44.572+00:00"),
    updatedAt: new Date("2026-11-20T06:12:44.572+00:00"),
  },
  {
    _id: new mongoose.Types.ObjectId("6affe4dc572bdc6f661995f0"),
    vendorId: new mongoose.Types.ObjectId("65f1a2b3c4d5e6f7a8b9c003"),
    vendorName: "Rohan Chowdhury",
    businessName: "Petals & Brass Co.",
    serviceName: "Intricate Mehndi & Henna Lounge",
    category: "Mehndi & Henna",
    description:
      "Bridal and guest mehndi artistry paired with vibrant lounge cushions, marigold accents, and evening lighting.",
    price: 48000,
    location: "Sylhet",
    images: [
      "https://i.pinimg.com/1200x/9a/bd/3b/9abd3bde805f25287d53e6199f2bdcda.jpg",
      "https://i.pinimg.com/1200x/d0/87/d0/d087d0dbd027044244ce4b4379d85cb8.jpg",
    ],
    status: "approved",
    isActive: true,
    createdAt: new Date("2026-11-20T06:12:44.572+00:00"),
    updatedAt: new Date("2026-11-20T06:12:44.572+00:00"),
  },
  {
    _id: new mongoose.Types.ObjectId("6affe4dc572bdc6f661995f1"),
    vendorId: new mongoose.Types.ObjectId("65f1a2b3c4d5e6f7a8b9c007"),
    vendorName: "Kabir Hasan",
    businessName: "Pulse & Rhythm Sound Co.",
    serviceName: "Holud & Reception DJ Sound Setup",
    category: "DJ & Entertainment",
    description:
      "Concert-grade sound system, dynamic stage lighting, and curated playlists for lively holud nights and evening receptions.",
    price: 52000,
    location: "Chattogram",
    images: [
      "https://i.pinimg.com/736x/67/fd/bb/67fdbb37c4a224db5af990cd253f730a.jpg",
      "https://i.pinimg.com/1200x/57/9d/26/579d267926b54eb3bd0909ceaeba210e.jpg",
    ],
    status: "approved",
    isActive: true,
    createdAt: new Date("2026-11-20T06:12:44.572+00:00"),
    updatedAt: new Date("2026-11-20T06:12:44.572+00:00"),
  },
  {
    _id: new mongoose.Types.ObjectId("6affe4dc572bdc6f661995f2"),
    vendorId: new mongoose.Types.ObjectId("65f1a2b3c4d5e6f7a8b9c004"),
    vendorName: "Tariq Mahmud",
    businessName: "Dastarkhwan Heritage Kitchen",
    serviceName: "Grand Banquet & Live Dessert Catering",
    category: "Catering & Desserts",
    description:
      "Full-service wedding catering with traditional main courses, live carving and grill counters, and signature sweets.",
    price: 110000,
    location: "Sylhet",
    images: [
      "https://i.pinimg.com/736x/80/1b/83/801b8334c957fa3e27f174b2f9cdfabc.jpg",
      "https://i.pinimg.com/736x/27/d5/b7/27d5b75ce35af092d344641e19a9eae1.jpg",
    ],
    status: "approved",
    isActive: true,
    createdAt: new Date("2026-11-20T06:12:44.572+00:00"),
    updatedAt: new Date("2026-11-20T06:12:44.572+00:00"),
  },
  {
    _id: new mongoose.Types.ObjectId("6affe4dc572bdc6f661995f3"),
    vendorId: new mongoose.Types.ObjectId("65f1a2b3c4d5e6f7a8b9c005"),
    vendorName: "Mahira Islam",
    businessName: "Atelier Lumiere",
    serviceName: "Soft Glam Bridal & Party Makeup",
    category: "Bridal Makeup & Styling",
    description:
      "Radiant soft-glam makeup and hair styling tailored for brides, bridesmaids, and reception evenings.",
    price: 19500,
    location: "Dhaka",
    images: [
      "https://i.pinimg.com/1200x/eb/f5/41/ebf54192203ce282c6bf2312ecf77216.jpg",
      "https://i.pinimg.com/736x/34/50/a8/3450a8a949b6dd63d70d68e19ded1bc9.jpg",
    ],
    status: "approved",
    isActive: true,
    createdAt: new Date("2026-11-20T06:12:44.572+00:00"),
    updatedAt: new Date("2026-11-20T06:12:44.572+00:00"),
  },
  {
    _id: new mongoose.Types.ObjectId("6affe4dc572bdc6f661995f4"),
    vendorId: new mongoose.Types.ObjectId("65f1a2b3c4d5e6f7a8b9c006"),
    vendorName: "Zayan Kabir",
    businessName: "Zari & Loom House",
    serviceName: "Royal Wedding Attire & Styling",
    category: "Bridal Wear & Attire",
    description:
      "Curated bridal couture, festive evening wear, and complete styling coordination for wedding ceremonies.",
    price: 59000,
    location: "Chattogram",
    images: [
      "https://i.pinimg.com/1200x/1d/88/28/1d8828bf66c51a8aed26eac2325ac343.jpg",
      "https://i.pinimg.com/1200x/e3/7f/45/e37f45b3cadefc7bb6fd01d929003625.jpg",
    ],
    status: "approved",
    isActive: true,
    createdAt: new Date("2026-11-20T06:12:44.572+00:00"),
    updatedAt: new Date("2026-11-20T06:12:44.572+00:00"),
  },
];

async function seed() {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not set in environment variables");
  }

  await mongoose.connect(
    MONGODB_URI,
    MONGODB_DB_NAME ? { dbName: MONGODB_DB_NAME } : undefined
  );

  const servicesCollection = mongoose.connection.collection("services");

  for (const doc of SEED_SERVICES) {
    await servicesCollection.updateOne(
      { _id: doc._id },
      { $set: doc },
      { upsert: true }
    );
  }

  console.log(`Seeded ${SEED_SERVICES.length} WedPlan services successfully.`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Failed to seed services:", err);
  process.exit(1);
});