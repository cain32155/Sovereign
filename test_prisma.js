const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
    try {
        const reviewerId = "TestUser";
        const reviewer = await prisma.user.findUnique({ where: { id: reviewerId } });
        console.log("Reviewer:", reviewer);
        
        const queue = await prisma.proofSubmission.findMany({
            where: {
                status: "PENDING",
                userId: { not: reviewerId },
                OR: [
                    { guildId: null },
                    { guildId: { not: reviewer?.guildId || "NONE" } }
                ],
                reviews: {
                    none: { reviewerId }
                }
            },
            take: 10
        });
        console.log("Queue size:", queue.length);
    } catch(e) {
        console.error("PRISMA ERROR:", e);
    } finally {
        await prisma.$disconnect();
    }
}
test();
