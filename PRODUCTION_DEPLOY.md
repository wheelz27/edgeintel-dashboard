# 🌐 Production Deployment Guide

Deploy your crypto advisor to the cloud for 24/7 operation!

## Quick Deploy Options

### Option 1: Digital Ocean App Platform (Easiest)
**Cost: $5/month**

1. Create a GitHub repository with these files:
   - `enhanced_api.py`
   - `requirements.txt` (contains: `flask==3.0.0`)
   - `dashboard.html`

2. Go to DigitalOcean → Apps → Create App
3. Connect your GitHub repo
4. Set run command: `python enhanced_api.py`
5. Deploy!

**URL**: `https://your-app.ondigitalocean.app`

---

### Option 2: Render (Free Tier Available)
**Cost: FREE for up to 750 hours/month**

1. Push code to GitHub
2. Go to render.com → New Web Service
3. Connect repository
4. Settings:
   - Environment: Python 3
   - Build: `pip install flask`
   - Start: `python enhanced_api.py`
5. Deploy!

**URL**: `https://your-app.onrender.com`

---

### Option 3: Railway (Simple & Fast)
**Cost: $5/month (free trial available)**

1. Push to GitHub
2. Go to railway.app → New Project → Deploy from GitHub
3. Select repository
4. Railway auto-detects and deploys
5. Done!

**URL**: `https://your-app.up.railway.app`

---

### Option 4: Heroku
**Cost: $7/month for basic dyno**

```bash
# Install Heroku CLI, then:
heroku create your-crypto-advisor
git init
git add .
git commit -m "Initial commit"
git push heroku main
```

Create `Procfile`:
```
web: python enhanced_api.py
```

Create `requirements.txt`:
```
flask==3.0.0
gunicorn==21.2.0
```

---

### Option 5: AWS EC2 (Most Control)
**Cost: Free tier eligible**

```bash
# SSH into your EC2 instance
ssh -i your-key.pem ubuntu@your-ec2-ip

# Install Python & dependencies
sudo apt update
sudo apt install python3 python3-pip -y
pip3 install flask

# Upload your files
scp -i your-key.pem enhanced_api.py ubuntu@your-ec2-ip:~/
scp -i your-key.pem dashboard.html ubuntu@your-ec2-ip:~/

# Run with PM2 for auto-restart
npm install -g pm2
pm2 start enhanced_api.py --interpreter python3
pm2 save
pm2 startup
```

---

### Option 6: VPS (DigitalOcean, Linode, Vultr)
**Cost: $5-10/month**

```bash
# SSH into VPS
ssh root@your-vps-ip

# Install dependencies
apt update && apt install python3 python3-pip nginx -y
pip3 install flask gunicorn

# Upload files
# Then run with systemd:

cat > /etc/systemd/system/crypto-advisor.service << EOF
[Unit]
Description=Crypto Advisor API
After=network.target

[Service]
User=root
WorkingDirectory=/root/crypto-advisor
ExecStart=/usr/local/bin/gunicorn -w 4 -b 0.0.0.0:5000 enhanced_api:app
Restart=always

[Install]
WantedBy=multi-user.target
EOF

systemctl enable crypto-advisor
systemctl start crypto-advisor
```

Configure nginx:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## Environment Variables

For production, set these:

```bash
export FLASK_ENV=production
export PORT=5000
export WORKERS=4
```

---

## SSL Certificate (HTTPS)

### Using Let's Encrypt (Free)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

Auto-renewal:
```bash
sudo certbot renew --dry-run
```

---

## Monitoring & Logs

### View Logs
```bash
# Heroku
heroku logs --tail

# PM2
pm2 logs

# Systemd
journalctl -u crypto-advisor -f

# Railway/Render
Check web dashboard
```

### Health Check Endpoint
Your API includes `/api/health` - use this for monitoring:

```bash
# Create a cron job to check health
*/5 * * * * curl https://your-app.com/api/health || echo "API DOWN"
```

### Uptime Monitoring
Use these free services:
- UptimeRobot (free)
- Pingdom (free tier)
- Better Uptime (free tier)

---

## Performance Optimization

### Use Gunicorn (Production WSGI)
```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 enhanced_api:app
```

### Add Caching
```python
from flask_caching import Cache

cache = Cache(app, config={'CACHE_TYPE': 'simple'})

@cache.cached(timeout=60)  # Cache for 60 seconds
@app.route('/api/analyze/<asset>')
def analyze(asset):
    # ... your code
```

### Rate Limiting
```python
from flask_limiter import Limiter

limiter = Limiter(app, key_func=lambda: request.remote_addr)

@limiter.limit("10 per minute")
@app.route('/api/analyze/<asset>')
def analyze(asset):
    # ... your code
```

---

## Domain Setup

1. Buy domain from Namecheap/Google Domains ($10/year)
2. Point DNS to your server:
   ```
   A Record: @ -> your-server-ip
   A Record: www -> your-server-ip
   ```
3. Wait for DNS propagation (5-30 min)
4. Access via: `https://yourdomain.com`

---

## Cost Comparison

| Platform | Cost/Month | Pros | Cons |
|----------|------------|------|------|
| Render Free | $0 | Free tier, easy setup | Spins down after inactivity |
| DigitalOcean | $5 | Reliable, good docs | No free tier |
| Railway | $5 | Super easy, auto-deploy | Limited free hours |
| Heroku | $7 | Mature platform | More expensive |
| AWS EC2 | $0-$5 | Free tier, scalable | Complex setup |
| VPS | $5 | Full control | Manual setup |

---

## Recommended Setup

**For Personal Use:**
- Render (free) or Railway ($5)
- Use demo dashboard locally
- Deploy API to cloud

**For Professional Use:**
- DigitalOcean App Platform ($5)
- Custom domain with SSL
- Monitoring + alerts
- Regular backups

**For Team/Business:**
- AWS EC2 or VPS ($10-20)
- Load balancer
- Auto-scaling
- Database for historical data

---

## Security Checklist

- [ ] Use HTTPS (SSL certificate)
- [ ] Add API rate limiting
- [ ] Set environment variables (no hardcoded secrets)
- [ ] Enable CORS only for your domain
- [ ] Add authentication if needed
- [ ] Keep Flask updated
- [ ] Use firewall rules
- [ ] Monitor error logs
- [ ] Backup configuration

---

## Custom Domain Example

After deploying to Render/Railway/DO:

1. Get deployment URL: `https://crypto-advisor-abc123.onrender.com`
2. Add custom domain: `api.cryptoadvisor.io`
3. Update DNS:
   ```
   CNAME: api -> crypto-advisor-abc123.onrender.com
   ```
4. Update dashboard.html:
   ```javascript
   const API_BASE_URL = 'https://api.cryptoadvisor.io/api';
   ```

---

## Troubleshooting

**502 Bad Gateway**
- Check if Flask is running
- Verify port bindings
- Check firewall rules

**Connection Timeout**
- CoinGecko rate limits (wait 60s)
- Increase timeout in code
- Add retry logic

**High Memory Usage**
- Reduce worker count
- Add request caching
- Clear logs regularly

---

## Next Steps

1. Choose deployment platform
2. Deploy enhanced_api.py
3. Configure custom domain (optional)
4. Set up monitoring
5. Share dashboard URL with team

**Need help?** Check platform-specific docs:
- Render: https://render.com/docs
- Railway: https://docs.railway.app
- DigitalOcean: https://docs.digitalocean.com
