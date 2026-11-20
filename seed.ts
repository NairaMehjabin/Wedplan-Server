import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "./db";
import { Service } from "./models/service";

const SEED_SERVICES = [
  {
    vendorId: new mongoose.Types.ObjectId("65f1a2b3c4d5e6f7a8b9c001"),
    vendorName: "Aarav Sen",
    businessName: "Keepsake Lens Studio",
    serviceName: "Golden Hour Film & Editorial Portraits",
    category: "Photography & Videography",
    description:
      "Full-day candid storytelling, 35mm-inspired portraits, and cinema highlight reels crafted for intimate ceremonies and grand receptions.",
    price: 45000,
    location: "Dhaka",
    images: [
      "https://i.pinimg.com/736x/9a/d1/2e/9ad12ef8b109c9bb815f613a61bb2542.jpg",
    ],
    status: "approved",
    isActive: true,
  },
  {
    vendorId: new mongoose.Types.ObjectId("65f1a2b3c4d5e6f7a8b9c002"),
    vendorName: "Nadia Rahman",
    businessName: "Rosewood Estates",
    serviceName: "Rosewood Courtyard & Banquet Hall",
    category: "Wedding Venues",
    description:
      "Sunlit courtyard lawn paired with an indoor heritage house, bridal suite access, ambient lighting, and dedicated event staff.",
    price: 165000,
    location: "Sylhet",
    images: [
      "https://i.pinimg.com/736x/75/b6/2b/75b62baf81b9aacb79b6338d4df69043.jpg",
    ],
    status: "approved",
    isActive: true,
  },
  {
    vendorId: new mongoose.Types.ObjectId("65f1a2b3c4d5e6f7a8b9c003"),
    vendorName: "Rohan Chowdhury",
    businessName: "Petals & Brass Co.",
    serviceName: "Peony & Brass Mandap Atelier",
    category: "Decoration & Florist",
    description:
      "Bespoke stage styling, fresh floral arrangements, brass accents, and warm aisle lanterns tailored to your palette.",
    price: 62000,
    location: "Chattogram",
    images: [
      "https://i.pinimg.com/736x/46/27/4f/46274feb7f38655f367fe63af4720d5f.jpg",
    ],
    status: "approved",
    isActive: true,
  },
  {
    vendorId: new mongoose.Types.ObjectId("65f1a2b3c4d5e6f7a8b9c004"),
    vendorName: "Tariq Mahmud",
    businessName: "Dastarkhwan Heritage Kitchen",
    serviceName: "Saffron & Cardamom Wedding Feast",
    category: "Catering Services",
    description:
      "Curated multi-course wedding menu featuring aromatic biryanis, live kebabs, artisanal desserts, and attentive hospitality.",
    price: 88000,
    location: "Dhaka",
    images: [
      "https://i.pinimg.com/736x/75/02/16/7502164c404cb0728c263b120dfe059d.jpg",
    ],
    status: "approved",
    isActive: true,
  },
  {
    vendorId: new mongoose.Types.ObjectId("65f1a2b3c4d5e6f7a8b9c005"),
    vendorName: "Mahira Islam",
    businessName: "Atelier Lumiere",
    serviceName: "Velvet & Dew Bridal Atelier",
    category: "Makeup & Styling",
    description:
      "Luminous skin-first bridal makeup, editorial hair styling, and pre-event skin prep with trial session and touch-up kit.",
    price: 24000,
    location: "Rajshahi",
    images: [
      "https://i.pinimg.com/736x/66/70/37/66703764a3777130835082d9c1076a02.jpg",
    ],
    status: "approved",
    isActive: true,
  },
  {
    vendorId: new mongoose.Types.ObjectId("65f1a2b3c4d5e6f7a8b9c006"),
    vendorName: "Zayan Kabir",
    businessName: "Zari & Loom House",
    serviceName: "Heirloom Saree Draping & Bridal Edit",
    category: "Wedding Fashion",
    description:
      "Bespoke bridal saree draping, hand-embellished bridal wear, and coordinating groom ensembles crafted with custom tailoring.",
    price: 54000,
    location: "Dhaka",
    images: [
      "https://i.pinimg.com/1200x/97/72/c1/9772c1451f2620210e8c0479efa24106.jpg",
    ],
    status: "approved",
    isActive: true,
  },
];

async function runSeed(): Promise<void> {
  try {
    await connectDB();

    const vendorIds = SEED_SERVICES.map((item) => item.vendorId);
    await Service.deleteMany({ vendorId: { $in: vendorIds } });

    const inserted = await Service.insertMany(SEED_SERVICES);
    console.log(`Seeded ${inserted.length} wedding services into wedplan_db.`);
  } catch (error) {
    console.error("Seed error:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
}

runSeed();