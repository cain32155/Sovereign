require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // Serve the ARISE frontend files

const { Client, GatewayIntentBits, ChannelType, PermissionsBitField } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const { Resend } = require('resend');
const jwt = require('jsonwebtoken');
const resend = new Resend(process.env.RESEND_API_KEY);
const JWT_SECRET = process.env.JWT_SECRET || 'sov_jwt_secret_994910_random_secure_key';

// ==========================================
// AUTHENTICATION SYSTEM (OTP)
// ==========================================
app.post('/api/auth/request-otp', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });

    // Generate 6 digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

    try {
        // Ensure user exists
        let user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            user = await prisma.user.create({
                data: {
                    email,
                    hunterName: `Hunter_${Math.floor(Math.random()*10000)}`
                }
            });
        }

        // Save OTP
        await prisma.otpCode.create({
            data: { email, code, expiresAt }
        });

        // Send Email
        await resend.emails.send({
            from: 'Sovereign System <onboarding@resend.dev>',
            to: email,
            subject: 'SYSTEM OVERRIDE: Verification Required',
            html: `<h2>SOVEREIGN AUTHENTICATION PROTOCOL</h2><p>Your one-time authorization code is: <strong>${code}</strong></p><p>This code will self-destruct in 5 minutes.</p>`
        });

        res.json({ success: true, message: "Code dispatched." });
    } catch (err) {
        console.error("OTP Request Error:", err);
        res.status(500).json({ error: "Failed to dispatch code." });
    }
});

app.post('/api/auth/verify-otp', async (req, res) => {
    const { email, code } = req.body;
    try {
        const otpRecord = await prisma.otpCode.findFirst({
            where: { email, code, expiresAt: { gt: new Date() } },
            orderBy: { createdAt: 'desc' }
        });

        if (!otpRecord) return res.status(401).json({ error: "Invalid or expired code." });

        // Generate JWT
        const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '7d' });
        
        // Fetch full user profile
        const user = await prisma.user.findUnique({ where: { email } });

        // Clean up OTPs
        await prisma.otpCode.deleteMany({ where: { email } });

        res.json({ success: true, token, user });
    } catch (err) {
        console.error("OTP Verify Error:", err);
        res.status(500).json({ error: "Verification failed." });
    }
});

// ==========================================
// USER PROFILE SETTINGS
// ==========================================
app.post('/api/user/update-profile', async (req, res) => {
    const { email, hunterName, profileUrl } = req.body;
    if (!email) return res.status(400).json({ error: "Email required." });

    try {
        const user = await prisma.user.update({
            where: { email },
            data: { hunterName, profileUrl }
        });
        res.json({ success: true, user });
    } catch (err) {
        console.error("Profile Update Error:", err);
        res.status(500).json({ error: "Failed to update profile." });
    }
});

// ==========================================
// FRIENDS & MESSAGING API
// ==========================================
app.get('/api/friends/list', async (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: "Email required" });
    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return res.status(404).json({ error: "User not found" });

        const friends = await prisma.friend.findMany({
            where: { OR: [{ userId: user.id }, { friendId: user.id }] },
            include: { user: true, friend: true }
        });
        res.json({ success: true, friends, userId: user.id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to load friends" });
    }
});

app.post('/api/friends/add', async (req, res) => {
    const { email, friendHunterName } = req.body;
    try {
        const sender = await prisma.user.findUnique({ where: { email } });
        const receiver = await prisma.user.findUnique({ where: { hunterName: friendHunterName } });
        if (!sender || !receiver) return res.status(404).json({ error: "Hunter not found" });
        if (sender.id === receiver.id) return res.status(400).json({ error: "Cannot add yourself" });

        // Check if exists
        const existing = await prisma.friend.findFirst({
            where: {
                OR: [
                    { userId: sender.id, friendId: receiver.id },
                    { userId: receiver.id, friendId: sender.id }
                ]
            }
        });

        if (existing) {
            if (existing.status === 'PENDING' && existing.friendId === sender.id) {
                // Accept request
                await prisma.friend.update({ where: { id: existing.id }, data: { status: 'ACCEPTED' } });
                return res.json({ success: true, message: "Friend request accepted!" });
            }
            return res.status(400).json({ error: "Friendship already exists or pending." });
        }

        await prisma.friend.create({
            data: { userId: sender.id, friendId: receiver.id, status: 'PENDING' }
        });
        res.json({ success: true, message: "Friend request sent!" });
    } catch (err) {
        res.status(500).json({ error: "Failed to add friend" });
    }
});

app.get('/api/messages/list', async (req, res) => {
    const { email, friendId } = req.query;
    try {
        const user = await prisma.user.findUnique({ where: { email } });
        const messages = await prisma.directMessage.findMany({
            where: {
                OR: [
                    { senderId: user.id, receiverId: friendId },
                    { senderId: friendId, receiverId: user.id }
                ]
            },
            orderBy: { createdAt: 'asc' },
            take: 50
        });
        res.json({ success: true, messages });
    } catch (err) {
        res.status(500).json({ error: "Failed to load messages" });
    }
});

app.post('/api/messages/send', async (req, res) => {
    const { email, receiverId, content } = req.body;
    try {
        const sender = await prisma.user.findUnique({ where: { email } });
        const msg = await prisma.directMessage.create({
            data: { senderId: sender.id, receiverId, content }
        });
        res.json({ success: true, msg });
    } catch (err) {
        res.status(500).json({ error: "Failed to send message" });
    }
});

// ==========================================
// DISCORD BOT & RATE-LIMIT QUEUE
// ==========================================
const discordQueue = [];
let isProcessingQueue = false;

async function processDiscordQueue() {
    if (isProcessingQueue || discordQueue.length === 0) return;
    isProcessingQueue = true;

    while (discordQueue.length > 0) {
        const task = discordQueue.shift();
        try {
            await task();
        } catch (err) {
            console.error("Discord Queue Task Error:", err);
        }
        // Wait 2 seconds between discord API calls to avoid rate limit
        await new Promise(res => setTimeout(res, 2000));
    }
    
    isProcessingQueue = false;
}

client.once('ready', () => {
    console.log(`[SYSTEM] Discord Bot Online as ${client.user.tag}`);
});

if (process.env.DISCORD_BOT_TOKEN) {
    client.login(process.env.DISCORD_BOT_TOKEN).catch(err => console.error("Discord Login Failed:", err));
} else {
    console.warn("[SYSTEM WARNING] DISCORD_BOT_TOKEN missing. Discord API disabled.");
}

// ==========================================
// THE HEARTBEAT ENGINE (APP-KILL EXPLOIT FIX)
// ==========================================
app.post('/api/heartbeat', async (req, res) => {
    const { userId, inDungeon, gateDurationMins } = req.body;
    
    if (!userId) return res.status(400).json({ error: "Missing userId" });
    
    try {
        let session = await prisma.dungeonSession.findUnique({ where: { userId } });
        
        if (inDungeon) {
            const expiresAt = new Date(Date.now() + (gateDurationMins || 25) * 60000);
            
            if (!session) {
                session = await prisma.dungeonSession.create({
                    data: { userId, expiresAt, status: "ACTIVE" }
                });
            } else if (session.status === "ACTIVE") {
                // Heartbeat pulse updates logic if needed
            }
            return res.json({ status: "ALIVE", session });
        } else {
            // Clean exit or not in dungeon
            if (session && session.status === "ACTIVE") {
                if (new Date() > session.expiresAt) {
                    await prisma.dungeonSession.update({
                        where: { userId },
                        data: { status: "COMPLETED" }
                    });
                    return res.json({ status: "CLEARED" });
                } else {
                    await prisma.dungeonSession.update({
                        where: { userId },
                        data: { status: "FAILED" }
                    });
                    return res.json({ status: "PENALTY_APPLIED" });
                }
            }
            return res.json({ status: "IDLE" });
        }
    } catch (error) {
        console.error("Heartbeat error:", error);
        res.status(500).json({ error: "System Error" });
    }
});

// ==========================================
// GUILD ARBITRATION (PEER REVIEW)
// ==========================================
app.post('/api/submissions', async (req, res) => {
    const { userId, questTitle, imageUrl, mlConfidence } = req.body;
    
    try {
        // Find user to check guild
        const user = await prisma.user.findUnique({ where: { id: userId } });
        
        const submission = await prisma.proofSubmission.create({
            data: {
                userId,
                guildId: user?.guildId,
                questTitle,
                imageUrl,
                status: "PENDING"
            }
        });
        res.json({ message: "Submission sent to Guild Arbitration.", submission });
    } catch (err) {
        res.status(500).json({ error: "Failed to queue submission." });
    }
});

app.get('/api/reviews/queue', async (req, res) => {
    const { reviewerId } = req.query;
    if (!reviewerId) return res.status(400).json({ error: "Missing reviewerId" });
    
    try {
        const reviewer = await prisma.user.findUnique({ where: { id: reviewerId } });
        
        // Find pending submissions NOT from the reviewer, and NOT from their guild
        const queue = await prisma.proofSubmission.findMany({
            where: {
                status: "PENDING",
                userId: { not: reviewerId },
                OR: [
                    { guildId: null },
                    { guildId: { not: reviewer?.guildId || "NONE" } }
                ],
                reviews: {
                    none: { reviewerId } // Haven't reviewed this yet
                }
            },
            take: 10
        });
        
        res.json({ queue });
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch queue." });
    }
});

app.post('/api/reviews/vote', async (req, res) => {
    const { submissionId, reviewerId, vote } = req.body;
    try {
        await prisma.guildReview.create({
            data: { submissionId, reviewerId, vote }
        });
        
        // Prototype logic: Resolve submission instantly on first vote
        await prisma.proofSubmission.update({
            where: { id: submissionId },
            data: { status: vote }
        });
        
        res.json({ message: "Vote recorded." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to submit vote." });
    }
});

// ==========================================
// GUILD API (WITH DISCORD INTEGRATION)
// ==========================================
app.post('/api/guild/create', async (req, res) => {
    const { userId, guildName } = req.body;
    if (!userId || !guildName) return res.status(400).json({ error: "Missing parameters" });
    
    try {
        // Find existing user or mock if testing
        let user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            user = await prisma.user.create({ 
                data: { 
                    id: userId, 
                    hunterName: userId,
                    email: userId + "@mock.com",
                    trustScore: 1.0 
                } 
            });
        }

        const guild = await prisma.guild.create({
            data: {
                name: guildName,
                leaderId: userId,
                inviteCode: "G_" + Math.random().toString(36).substring(2, 8).toUpperCase()
            }
        });

        await prisma.user.update({
            where: { id: userId },
            data: { guildId: guild.id }
        });

        const serverId = process.env.DISCORD_GUILD_ID;
        if (serverId && process.env.DISCORD_BOT_TOKEN) {
            discordQueue.push(async () => {
                const discordGuild = await client.guilds.fetch(serverId);
                if (discordGuild) {
                    const channel = await discordGuild.channels.create({
                        name: `guild-${guildName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
                        type: ChannelType.GuildText,
                        permissionOverwrites: [
                            {
                                id: discordGuild.roles.everyone.id,
                                deny: [PermissionsBitField.Flags.ViewChannel],
                            }
                        ]
                    });
                    console.log(`[SYSTEM] Provisioned Discord Channel: ${channel.name}`);
                }
            });
            processDiscordQueue();
        }

        res.json({ message: "Guild created successfully.", guild });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to create guild." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`[SYSTEM] ARISE Backend Initialized on Port ${PORT}`);
});
