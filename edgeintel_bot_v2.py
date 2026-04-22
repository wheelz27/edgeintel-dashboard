"""
EDGEINTEL DISCORD BOT v2 — Plug & Play
========================================
FIXED: Free tier now TEASES picks (no reveal). Paid tier gets everything.
ADDED: PayPal payment flow + auto role assignment instructions.
ADDED: Simpler daily workflow — just update picks.json and !post_picks

SETUP:
  1. pip install discord.py
  2. Fill in YOUR_BOT_TOKEN and channel IDs below
  3. python edgeintel_bot.py
  4. Update picks.json daily → type !post_picks → done
"""

import discord
from discord.ext import commands, tasks
from discord import app_commands
import json
import os
import random
import string
from datetime import datetime

# ================================================================
# ⚙️  CONFIG — Fill these in (the ONLY lines you touch)
# ================================================================
BOT_TOKEN = "YOUR_BOT_TOKEN"

# Channel IDs (right-click channel → Copy Channel ID)
CHANNEL_FREE_PICKS   = 0    # #free-picks
CHANNEL_DAILY_CODE   = 0    # #daily-code (Syndicate only)
CHANNEL_FULL_DOSSIER = 0    # #full-dossiers (Syndicate only)
CHANNEL_LINE_ALERTS  = 0    # #line-alerts (Syndicate only)
CHANNEL_RESULTS      = 0    # #results
CHANNEL_WELCOME      = 0    # #welcome

SYNDICATE_ROLE_NAME = "Syndicate"
DASHBOARD_URL = "https://your-edgeintel-app.vercel.app"
CODE_PREFIX = "EDGE"
PAYPAL_LINK = "https://paypal.me/Wheelz27"  # Your PayPal
PAYPAL_EMAIL = "Wheelz27@outlook.com"
PRICE = "$29"
PRICE_PERIOD = "/mo"

# ================================================================
# 📁  DATA LOADING
# ================================================================
def load_picks():
    """Load from picks.json — just overwrite this file daily."""
    if os.path.exists("picks.json"):
        with open("picks.json", "r") as f:
            return json.load(f)
    return []

def load_results():
    if os.path.exists("results.json"):
        with open("results.json", "r") as f:
            return json.load(f)
    return []

def generate_daily_code():
    today = datetime.now().strftime("%m%d")
    suffix = ''.join(random.choices(string.ascii_uppercase, k=2))
    return f"{CODE_PREFIX}{today}{suffix}"

# ================================================================
# 🤖  BOT SETUP
# ================================================================
intents = discord.Intents.default()
intents.message_content = True
intents.members = True
bot = commands.Bot(command_prefix="!", intents=intents)
current_code = ""

# ================================================================
# 📤  EMBEDS
# ================================================================

def build_free_teaser(picks):
    """
    FREE TIER — Shows games + confidence ONLY. 
    Does NOT reveal the actual pick, odds, or book.
    This is the hook that makes people want to subscribe.
    """
    top_3 = sorted(picks, key=lambda x: x.get("confidence", 0), reverse=True)[:3]
    
    embed = discord.Embed(
        title="🔥 EDGEINTEL — Today's Card",
        description=(
            f"**{len(picks)} picks locked and loaded**\n"
            f"Top 3 confidence ratings below — picks are hidden.\n"
            f"━━━━━━━━━━━━━━━━━━━━━━"
        ),
        color=0x4D8EFF,
        timestamp=datetime.utcnow()
    )
    
    for i, p in enumerate(top_3, 1):
        conf = p.get("confidence", 0)
        conf_bar = "█" * (conf // 10) + "░" * (10 - conf // 10)
        
        embed.add_field(
            name=f"#{i}  {p.get('icon', '🎯')}  {p['game']}",
            value=(
                f"**{p['sport']}** • {p['market']}\n"
                f"📊 `{conf_bar}` **{conf}%** confidence\n"
                f"🔒 **Pick hidden** — Syndicate members only"
            ),
            inline=False
        )
    
    remaining = len(picks) - 3
    if remaining > 0:
        embed.add_field(
            name=f"➕ {remaining} more picks on today's card",
            value="Full slate available to Syndicate members",
            inline=False
        )
    
    embed.add_field(
        name="🔓 Want the picks?",
        value=(
            f"**Subscribe to Syndicate ({PRICE}{PRICE_PERIOD})** to unlock:\n"
            f"✅ All picks with odds & book\n"
            f"✅ Full dossiers — why, risk, execution\n"
            f"✅ Dashboard access code for Scotty AI\n"
            f"✅ Real-time line movement alerts\n\n"
            f"💰 **[Pay via PayPal]({PAYPAL_LINK})** → DM me your receipt → get instant access"
        ),
        inline=False
    )
    
    embed.set_footer(text="EdgeIntel — Model-driven edge, not guesswork")
    return embed


def build_full_picks(picks):
    """SYNDICATE TIER — Full picks with everything revealed."""
    sorted_picks = sorted(picks, key=lambda x: x.get("confidence", 0), reverse=True)
    
    embed = discord.Embed(
        title="🧠 SYNDICATE — Full Card Unlocked",
        description=(
            f"**{len(picks)} picks • Full dossiers**\n"
            f"Dashboard → [Open]({DASHBOARD_URL}) • Use today's code to unlock Scotty AI\n"
            f"━━━━━━━━━━━━━━━━━━━━━━"
        ),
        color=0x00E5C3,
        timestamp=datetime.utcnow()
    )
    
    for p in sorted_picks:
        conf = p.get("confidence", 0)
        why_text = "\n".join([f"  ✅ {w}" for w in p.get("why", [])[:2]])
        risk_text = "\n".join([f"  ⚠️ {r}" for r in p.get("risk", [])[:2]])
        
        embed.add_field(
            name=f"{p.get('icon', '🎯')} {p['game']} — {p['pick']} ({p['odds']})",
            value=(
                f"📊 **{conf}%** • {p['market']} • {p.get('book', 'Best available')}\n"
                f"**Edge:**\n{why_text}\n"
                f"**Risk:**\n{risk_text}\n"
                f"⚡ **Exec:** {p.get('execution', 'Standard sizing')}"
            ),
            inline=False
        )
    
    embed.set_footer(text="🚫 Do not share outside Syndicate")
    return embed


def build_code_embed(code):
    """Daily access code for the dashboard."""
    embed = discord.Embed(
        title="🔐 Today's Dashboard Code",
        description=(
            f"# `{code}`\n\n"
            f"Enter at [EdgeIntel Dashboard]({DASHBOARD_URL}) → Unlock tab\n"
            f"Unlocks: full dossiers, execution rules, Scotty AI\n\n"
            f"⏰ Expires at midnight ET\n"
            f"🚫 Do not share outside Syndicate"
        ),
        color=0xF5A623,
        timestamp=datetime.utcnow()
    )
    return embed


def build_results(results):
    """Results recap."""
    if not results:
        return discord.Embed(title="📊 No results yet", color=0x4D8EFF)
    
    wins = sum(1 for r in results if r.get("result") == "W")
    losses = sum(1 for r in results if r.get("result") == "L")
    total = len(results)
    profit = sum(float(r.get("profit", "0").replace("u", "").replace("+", "")) for r in results)
    wr = (wins / total * 100) if total else 0
    
    embed = discord.Embed(
        title="📊 EDGEINTEL — Results",
        description=(
            f"**{wins}W - {losses}L** ({wr:.1f}% win rate)\n"
            f"**P&L:** {'+'if profit > 0 else ''}{profit:.2f}u\n"
            f"━━━━━━━━━━━━━━━━━━━━━━"
        ),
        color=0x22C55E if profit > 0 else 0xEF4444,
        timestamp=datetime.utcnow()
    )
    
    for r in results[:10]:
        emoji = "✅" if r.get("result") == "W" else "❌"
        embed.add_field(
            name=f"{emoji} {r['game']}",
            value=f"`{r['pick']}` → **{r['result']}** ({r.get('profit', 'N/A')})",
            inline=True
        )
    
    embed.set_footer(text=f"Full history → {DASHBOARD_URL}")
    return embed


def build_welcome():
    """Welcome new members."""
    embed = discord.Embed(
        title="Welcome to EdgeIntel 🧠",
        description=(
            "AI-powered sports betting intelligence.\n"
            "We don't guess. We model.\n"
            "━━━━━━━━━━━━━━━━━━━━━━"
        ),
        color=0x4D8EFF,
    )
    embed.add_field(
        name="🆓 What you get free",
        value=(
            "• See which games we're targeting\n"
            "• Confidence ratings on every pick\n"
            "• Full results & track record\n"
            "• Community discussion"
        ),
        inline=False
    )
    embed.add_field(
        name=f"🔒 Syndicate ({PRICE}{PRICE_PERIOD})",
        value=(
            "• **Every pick revealed** — odds, book, sizing\n"
            "• **Full dossiers** — edge reasoning, risk, execution\n"
            "• **Scotty AI** — ask anything about any pick\n"
            "• **Dashboard unlock** — daily access codes\n"
            "• **Line alerts** — real-time movement notifications\n"
            "• **Private chat** — Syndicate members only\n\n"
            f"💰 **[Pay via PayPal]({PAYPAL_LINK})** → DM me your receipt"
        ),
        inline=False
    )
    embed.set_footer(text="EdgeIntel — Built different.")
    return embed


def build_payment_instructions():
    """Payment instructions embed."""
    embed = discord.Embed(
        title=f"💰 Subscribe to Syndicate — {PRICE}{PRICE_PERIOD}",
        description=(
            f"**Step 1:** Send {PRICE} to PayPal\n"
            f"→ **[Click here to pay]({PAYPAL_LINK})**\n"
            f"→ Or send to: `{PAYPAL_EMAIL}`\n"
            f"→ Note: include your Discord username\n\n"
            f"**Step 2:** DM me (wheelz_27) a screenshot of your receipt\n\n"
            f"**Step 3:** I'll assign your Syndicate role within minutes\n\n"
            f"━━━━━━━━━━━━━━━━━━━━━━\n"
            f"Once you have the role, you instantly unlock:\n"
            f"🔓 All hidden picks + full dossiers\n"
            f"🔓 Daily dashboard codes + Scotty AI\n"
            f"🔓 Line alerts + private chat"
        ),
        color=0xF5A623,
    )
    embed.set_footer(text="Access is instant once payment is confirmed")
    return embed


# ================================================================
# 🔄  SCHEDULED TASKS
# ================================================================

@tasks.loop(hours=24)
async def auto_daily_post():
    """Auto-posts every 24h. Or just use !post_picks manually."""
    global current_code
    picks = load_picks()
    if not picks:
        return
    
    current_code = generate_daily_code()

    # Save code to file — delivered ONLY via /code slash command (Syndicate only, ephemeral)
    # NEVER post the code to any Discord channel where free members can see it
    with open("current_code.txt", "w") as f:
        f.write(current_code)

    for ch_id, embed_fn in [
        (CHANNEL_FREE_PICKS,   lambda: build_free_teaser(picks)),   # teaser only, no picks
        (CHANNEL_FULL_DOSSIER, lambda: build_full_picks(picks)),     # Syndicate channel
        # CHANNEL_DAILY_CODE intentionally removed — code is never posted publicly
    ]:
        ch = bot.get_channel(ch_id)
        if ch:
            try:
                await ch.send(embed=embed_fn())
            except Exception as e:
                print(f"Error posting to {ch_id}: {e}")

    print(f"[{datetime.now()}] Auto-posted. Code saved to file (not posted to Discord).")


# ================================================================
# 📨  EVENTS
# ================================================================

@bot.event
async def on_ready():
    print(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print(f"  EDGEINTEL BOT v2 ONLINE")
    print(f"  {bot.user}")
    print(f"  Servers: {len(bot.guilds)}")
    print(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    
    if not auto_daily_post.is_running():
        auto_daily_post.start()
    
    try:
        await bot.tree.sync()
        print("  ✓ Slash commands synced")
    except Exception as e:
        print(f"  ✗ Sync error: {e}")
    print()


@bot.event
async def on_member_join(member):
    ch = bot.get_channel(CHANNEL_WELCOME)
    if ch:
        await ch.send(f"Welcome {member.mention}! 👋", embed=build_welcome())


# ================================================================
# 🎮  SLASH COMMANDS
# ================================================================

@bot.tree.command(name="picks", description="See today's card (teaser)")
async def cmd_picks(interaction: discord.Interaction):
    picks = load_picks()
    if picks:
        await interaction.response.send_message(embed=build_free_teaser(picks))
    else:
        await interaction.response.send_message("📭 No picks loaded yet. Check back soon.", ephemeral=True)


@bot.tree.command(name="dossier", description="Full pick dossiers (Syndicate only)")
async def cmd_dossier(interaction: discord.Interaction):
    role = discord.utils.get(interaction.guild.roles, name=SYNDICATE_ROLE_NAME)
    if role and role in interaction.user.roles:
        picks = load_picks()
        if picks:
            await interaction.response.send_message(embed=build_full_picks(picks), ephemeral=True)
        else:
            await interaction.response.send_message("📭 No picks loaded yet.", ephemeral=True)
    else:
        await interaction.response.send_message(embed=build_payment_instructions(), ephemeral=True)


@bot.tree.command(name="code", description="Today's dashboard code (Syndicate only)")
async def cmd_code(interaction: discord.Interaction):
    global current_code
    role = discord.utils.get(interaction.guild.roles, name=SYNDICATE_ROLE_NAME)
    if role and role in interaction.user.roles:
        if current_code:
            await interaction.response.send_message(embed=build_code_embed(current_code), ephemeral=True)
        else:
            await interaction.response.send_message("⏳ Code not generated yet. Ask the admin to run `!post_picks`.", ephemeral=True)
    else:
        await interaction.response.send_message(embed=build_payment_instructions(), ephemeral=True)


@bot.tree.command(name="results", description="View track record")
async def cmd_results(interaction: discord.Interaction):
    results = load_results()
    await interaction.response.send_message(embed=build_results(results))


@bot.tree.command(name="subscribe", description="How to get Syndicate access")
async def cmd_subscribe(interaction: discord.Interaction):
    await interaction.response.send_message(embed=build_payment_instructions())


@bot.tree.command(name="dashboard", description="Open the EdgeIntel dashboard")
async def cmd_dashboard(interaction: discord.Interaction):
    embed = discord.Embed(
        title="📊 EdgeIntel Dashboard",
        description=(
            f"**[Open Dashboard →]({DASHBOARD_URL})**\n\n"
            f"Syndicate members: use `/code` to get today's unlock code."
        ),
        color=0x4D8EFF
    )
    await interaction.response.send_message(embed=embed)


# ================================================================
# 🔧  ADMIN COMMANDS (you only)
# ================================================================

@bot.command(name="post_picks")
@commands.is_owner()
async def admin_post_picks(ctx):
    """
    YOUR DAILY COMMAND.
    1. Update picks.json
    2. Type !post_picks
    3. Done. Bot handles everything.
    """
    global current_code
    picks = load_picks()
    
    if not picks:
        await ctx.send("❌ No picks found. Save your picks to `picks.json` first.")
        return
    
    current_code = generate_daily_code()

    # Save code to file — members get it via /code (Syndicate only, ephemeral)
    # NEVER post the code as a channel message
    with open("current_code.txt", "w") as f:
        f.write(current_code)

    posted = []
    for ch_id, name, embed in [
        (CHANNEL_FREE_PICKS,   "#free-picks",   build_free_teaser(picks)),   # teaser only
        (CHANNEL_FULL_DOSSIER, "#full-dossiers", build_full_picks(picks)),   # Syndicate only
        # Daily code channel removed — code is NEVER posted to a channel
    ]:
        ch = bot.get_channel(ch_id)
        if ch:
            try:
                await ch.send(embed=embed)
                posted.append(f"✅ {name}")
            except Exception as e:
                posted.append(f"❌ {name}: {e}")
        else:
            posted.append(f"⚠️ {name}: channel not found (check ID)")

    report = "\n".join(posted)
    await ctx.send(
        f"**Daily post complete!**\n{report}\n\n"
        f"📌 Today's code: `{current_code}` ← This is ONLY visible to you here\n"
        f"📌 Syndicate members use `/code` to get it privately\n"
        f"📌 Update your dashboard env too"
    )


@bot.command(name="post_results")
@commands.is_owner()
async def admin_post_results(ctx):
    results = load_results()
    ch = bot.get_channel(CHANNEL_RESULTS)
    if ch and results:
        await ch.send(embed=build_results(results))
        await ctx.send("✅ Results posted to #results")
    else:
        await ctx.send("❌ No results found or channel not configured.")


@bot.command(name="new_code")
@commands.is_owner()
async def admin_new_code(ctx):
    global current_code
    current_code = generate_daily_code()
    with open("current_code.txt", "w") as f:
        f.write(current_code)
    await ctx.send(f"✅ New code: `{current_code}`")


@bot.command(name="set_code")
@commands.is_owner()
async def admin_set_code(ctx, code: str):
    global current_code
    current_code = code.upper()
    with open("current_code.txt", "w") as f:
        f.write(current_code)
    await ctx.send(f"✅ Code set: `{current_code}`")


@bot.command(name="alert")
@commands.is_owner()
async def admin_alert(ctx, *, message: str):
    ch = bot.get_channel(CHANNEL_LINE_ALERTS)
    if ch:
        embed = discord.Embed(
            title="🚨 LINE ALERT",
            description=message,
            color=0xEF4444,
            timestamp=datetime.utcnow()
        )
        await ch.send(embed=embed)
        await ctx.send("✅ Alert sent to #line-alerts")
    else:
        await ctx.send("❌ Line alerts channel not found.")


@bot.command(name="grant")
@commands.is_owner()
async def admin_grant(ctx, member: discord.Member):
    """
    Grant Syndicate role after PayPal payment.
    Usage: !grant @username
    """
    role = discord.utils.get(ctx.guild.roles, name=SYNDICATE_ROLE_NAME)
    if role:
        await member.add_roles(role)
        await ctx.send(f"✅ {member.mention} is now a Syndicate member!")
        
        # DM the new member
        try:
            embed = discord.Embed(
                title="🎉 Welcome to Syndicate!",
                description=(
                    "Your access is now active. Here's what you can do:\n\n"
                    "📌 **#daily-code** — get today's dashboard unlock code\n"
                    "📌 **#full-dossiers** — complete pick analysis\n"
                    "📌 **#line-alerts** — real-time notifications\n"
                    "📌 **#syndicate-chat** — private discussion\n\n"
                    f"🔗 **[Open Dashboard]({DASHBOARD_URL})** and enter today's code\n\n"
                    "Use `/code` anytime to get the current access code.\n"
                    "Use `/dossier` to see today's full picks."
                ),
                color=0x00E5C3,
            )
            await member.send(embed=embed)
        except:
            pass  # DMs might be off
    else:
        await ctx.send(f"❌ Role '{SYNDICATE_ROLE_NAME}' not found. Create it first.")


@bot.command(name="revoke")
@commands.is_owner()
async def admin_revoke(ctx, member: discord.Member):
    """Remove Syndicate role. Usage: !revoke @username"""
    role = discord.utils.get(ctx.guild.roles, name=SYNDICATE_ROLE_NAME)
    if role:
        await member.remove_roles(role)
        await ctx.send(f"✅ Removed Syndicate from {member.mention}")
    else:
        await ctx.send(f"❌ Role not found.")


@bot.command(name="help_admin")
@commands.is_owner()
async def admin_help(ctx):
    """Show all admin commands."""
    embed = discord.Embed(
        title="🔧 Admin Commands",
        description="Only you (server owner) can use these.",
        color=0x4D8EFF
    )
    cmds = [
        ("`!post_picks`", "Post today's picks to all channels + generate code"),
        ("`!post_results`", "Post results recap to #results"),
        ("`!new_code`", "Generate a fresh access code"),
        ("`!set_code MYCODE`", "Set a specific custom code"),
        ("`!alert Your message`", "Send line alert to Syndicate"),
        ("`!grant @user`", "Give someone Syndicate role (after payment)"),
        ("`!revoke @user`", "Remove someone's Syndicate role"),
    ]
    for cmd, desc in cmds:
        embed.add_field(name=cmd, value=desc, inline=False)
    
    embed.add_field(
        name="📋 Daily Workflow",
        value=(
            "1. Update `picks.json` with today's model output\n"
            "2. Type `!post_picks`\n"
            "3. Update dashboard code to match\n"
            "4. When someone pays via PayPal → `!grant @them`"
        ),
        inline=False
    )
    await ctx.send(embed=embed)


# ================================================================
# 🚀  RUN
# ================================================================
if __name__ == "__main__":
    if BOT_TOKEN == "YOUR_BOT_TOKEN":
        print("=" * 50)
        print("  ERROR: Set your BOT_TOKEN!")
        print("  Open this file and paste your token.")
        print("=" * 50)
    else:
        bot.run(BOT_TOKEN)
