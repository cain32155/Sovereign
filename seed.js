const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Seeding fake users and arbitration submissions...");

    // Create Dummy Users
    const dummies = [
        { id: "dummy_1", hunterName: "IRON_BODY", email: "iron@mock.com", trustScore: 1.0 },
        { id: "dummy_2", hunterName: "NEO_ARCHITECT", email: "neo@mock.com", trustScore: 1.0 },
        { id: "dummy_3", hunterName: "SHADOW_MONARCH", email: "shadow@mock.com", trustScore: 1.0 }
    ];

    for (const d of dummies) {
        await prisma.user.upsert({
            where: { id: d.id },
            update: {},
            create: d
        });
    }

    // Create Pending Submissions
    const submissions = [
        { userId: "dummy_1", questTitle: "The Iron Trial (225lb PR)", imageUrl: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=400&auto=format&fit=crop", status: "PENDING" },
        { userId: "dummy_2", questTitle: "Code for 4 hours", imageUrl: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?q=80&w=400&auto=format&fit=crop", status: "PENDING" },
        { userId: "dummy_3", questTitle: "Run 5km under 25 mins", imageUrl: "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?q=80&w=400&auto=format&fit=crop", status: "PENDING" }
    ];

    for (const s of submissions) {
        await prisma.proofSubmission.create({
            data: s
        });
    }

    console.log("Database seeded successfully!");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
