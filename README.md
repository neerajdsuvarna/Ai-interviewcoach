# 🎯 Interview Coach AI Platform

This **AI-powered interview coaching platform** provides comprehensive mock interview experiences with real-time feedback, audio processing, and advanced analytics tracking.

---

## 🌟 **Features**
- **AI Mock Interviews** – Personalized interview questions based on resume and job description
- **Real-time Audio Processing** – Voice synthesis and transcription using Piper TTS and Whisper
- **Comprehensive Feedback** – AI-generated performance analysis with strengths and improvement areas
- **Payment Integration** – Secure payment processing with Dodo Payments
- **Analytics Tracking** – Mixpanel integration for user behavior and conversion tracking
- **Head Tracking** – Real-time eye contact and attention monitoring
- **Audio Enhancement** – Noise removal and audio quality improvement
- **GPU Acceleration** – Supports **CUDA, MPS, or CPU**  

---

## 🚀 **Production Deployment (Vast.AI)**

This guide covers deploying the application to a Vast.AI instance with Apache2 as a reverse proxy.

### **Prerequisites**
- Vast.AI instance with Ubuntu/Debian
- Domain name configured (e.g., `dev.ugaanlabs.com`)
- SSL certificates (fullchain.pem, privkey.pem, chain.pem)
- SSH access to the instance

### **1. Vast.AI Instance Setup**

Use the following template when creating your Vast.AI instance:

![Instance Template](Instance%20Template.png)

**Port Forwarding Configuration:**
- **Port 40585** → **443/tcp** (HTTPS)
- **Port 40594** → **80/tcp** (HTTP)
- **Port 40591** → **22/tcp** (SSH)
- **Port 40584** → **5000/tcp** (Flask backend - optional, for direct access)

### **2. DNS Configuration**

Configure your DNS records as shown in the image below:

![DNS Record](DNS%20Record.png)

**DNS Setup:**
- In the **Advanced** section of your domain settings, add:
  - **Host**: `dev`
  - **Value**: Your instance public IP (e.g., `65.93.186.85`)

**Update Frontend Environment:**
- Update the frontend `.env` file with:
  ```env
  VITE_API_BASE_URL=https://dev.ugaanlabs.com:40585
  ```
- Make the changes and push to the `Vast-Deployement-Branch` branch

### **3. Connect to Instance**

```bash
ssh -p 40591 root@65.93.186.85
```

(Replace `40591` with your SSH port and `65.93.186.85` with your instance IP)

### **4. Clone Repository**

```bash
git clone <your-repo-url>
cd interviewcoach
git checkout feat/Vast-Deployement-Branch
```

### **5. Install Backend Dependencies**

```bash
chmod +x install_dependencies_linux.sh
./install_dependencies_linux.sh
```

### **6. Install and Configure Apache2**

#### **Step 1: Install Build Dependencies**
```bash
sudo apt update
sudo apt install -y build-essential wget libtool autoconf automake
sudo apt install -y libapr1-dev libaprutil1-dev libpcre2-dev libssl-dev libexpat1-dev
```

#### **Step 2: Download APR and APR-util**
```bash
cd /tmp
wget https://archive.apache.org/dist/apr/apr-1.7.4.tar.gz
wget https://archive.apache.org/dist/apr/apr-util-1.6.3.tar.gz
```

#### **Step 3: Install APR**
```bash
tar -xzf apr-1.7.4.tar.gz
cd apr-1.7.4
./configure --prefix=/usr/local/apr
make && sudo make install
```

#### **Step 4: Install APR-util**
```bash
cd /tmp
tar -xzf apr-util-1.6.3.tar.gz
cd apr-util-1.6.3
./configure --prefix=/usr/local/apr-util --with-apr=/usr/local/apr
make && sudo make install
```

#### **Step 5: Install Apache HTTP Server**
```bash
cd /tmp
wget https://archive.apache.org/dist/httpd/httpd-2.4.58.tar.gz
tar -xzf httpd-2.4.58.tar.gz
cd httpd-2.4.58
./configure --prefix=/usr/local/apache2 --with-apr=/usr/local/apr --with-apr-util=/usr/local/apr-util --enable-ssl --enable-rewrite --enable-proxy --enable-proxy-http --enable-proxy-wstunnel --enable-headers --enable-deflate
make && sudo make install
```

#### **Step 6: Create Apache User**
```bash
sudo groupadd apache
sudo useradd -g apache -r -s /bin/false apache
sudo chown -R apache:apache /usr/local/apache2
```

### **7. Copy SSL Certificates**

From your local machine (Windows), copy certificates to the server:

**Note**: `65.93.186.85` is the public IP of the instance (replace with your actual IP).

```bash
# Copy fullchain.pem
scp -P 40591 "C:\path\to\your\certificates\fullchain.pem" root@65.93.186.85:/etc/letsencrypt/live/dev.ugaanlabs.com/

# Copy privkey.pem
scp -P 40591 "C:\path\to\your\certificates\privkey.pem" root@65.93.186.85:/etc/letsencrypt/live/dev.ugaanlabs.com/

# Copy chain.pem
scp -P 40591 "C:\path\to\your\certificates\chain.pem" root@65.93.186.85:/etc/letsencrypt/live/dev.ugaanlabs.com/
```

**On the server**, create the directory and set permissions:

```bash
# Create directory if it doesn't exist
sudo mkdir -p /etc/letsencrypt/live/dev.ugaanlabs.com/

```

### **8. Copy Apache Configuration Files**

Copy the configuration files from the repository to Apache:

**Easiest method (using nano):**

1. Remove existing configs:
   ```bash
   sudo rm /usr/local/apache2/conf/httpd.conf
   sudo rm /usr/local/apache2/conf/extra/httpd-ssl.conf
   sudo rm /usr/local/apache2/conf/extra/httpd-vhosts.conf
   ```

2. Edit each file:
   ```bash
   sudo nano /usr/local/apache2/conf/httpd.conf
   sudo nano /usr/local/apache2/conf/extra/httpd-ssl.conf
   sudo nano /usr/local/apache2/conf/extra/httpd-vhosts.conf
   ```

3. Copy contents from repository files:
   - **Inside terminal**: `Ctrl+Insert` (copy), `Shift+Insert` (paste)
   - **On Windows**: `Ctrl+C`, then inside nano `Shift+Insert` (paste)

**Alternative method (using cp):**
```bash
sudo cp ~/interviewcoach/httpd.conf /usr/local/apache2/conf/
sudo cp ~/interviewcoach/httpd-ssl.conf /usr/local/apache2/conf/extra/
sudo cp ~/interviewcoach/httpd-vhosts.conf /usr/local/apache2/conf/extra/
```

### **9. Build and Deploy Frontend**

```bash
cd ~/interviewcoach/frontend
npm install
npm install @monaco-editor/react
npm run build

# Copy build files to Apache
sudo cp -r dist/* /usr/local/apache2/htdocs/
```

### **10. Start Apache**

```bash
# Start Apache
sudo /usr/local/apache2/bin/apachectl start

# To restart Apache
sudo /usr/local/apache2/bin/apachectl restart
```

**If rebuilding**, clear old files first:
```bash
cd ~/interviewcoach/frontend
npm install
npm install @monaco-editor/react
npm run build
sudo rm -rf /usr/local/apache2/htdocs/*
sudo cp -r dist/* /usr/local/apache2/htdocs/
sudo /usr/local/apache2/bin/apachectl restart
```

### **11. Start Backend**

```bash
cd ~/interviewcoach/backend

# Start backend with Python
python app.py

# Or run in background
nohup python app.py > /tmp/backend.log 2>&1 &
```

### **12. Verify Deployment**

Access your site:
- **HTTPS**: `https://dev.ugaanlabs.com:40585`

**Check Apache status:**
```bash
sudo /usr/local/apache2/bin/apachectl status
```

**Check if services are running:**
```bash
sudo netstat -tlnp | grep -E '(httpd|5000)'
```

### **13. Useful Apache Commands**

```bash
# Test configuration
sudo /usr/local/apache2/bin/apachectl configtest

# Start Apache
sudo /usr/local/apache2/bin/apachectl start

# Stop Apache
sudo /usr/local/apache2/bin/apachectl stop

# Restart Apache
sudo /usr/local/apache2/bin/apachectl restart

# Check status
sudo /usr/local/apache2/bin/apachectl status

# View error logs
sudo tail -f /usr/local/apache2/logs/error_log

# View access logs
sudo tail -f /usr/local/apache2/logs/access_log
```

---

## **Key Features & Technologies**

### **Interview Coaching System**
- **Resume Analysis**: AI-powered resume parsing and job description matching
- **Question Generation**: Dynamic interview questions based on role and experience level
- **Real-time Interview**: Interactive chat interface with voice synthesis
- **Performance Evaluation**: Comprehensive feedback with strengths and improvement areas
- **Audio Recording**: Complete interview transcript with audio playback

### **Payment & Analytics**
- **Payment Processing**: Secure payment integration with Dodo Payments
- **User Analytics**: Mixpanel tracking for user behavior and conversion metrics
- **Interview History**: Complete record of all user interviews and feedback

### **Technical Stack**
- **Frontend**: React with Vite, Tailwind CSS, Framer Motion
- **Backend**: Flask with Socket.IO for real-time communication
- **AI Models**: Ollama (Llama3), Piper TTS, Whisper STT

---

## **Troubleshooting**

### **Common Issues:**

1. **Apache Not Starting**: Check error logs with `sudo tail -f /usr/local/apache2/logs/error_log`
2. **SSL Certificate Issues**: Verify certificate paths and permissions in `httpd-ssl.conf`
3. **Backend Not Responding**: Check if Python app is running with `ps aux | grep python`
4. **Frontend Not Loading**: Verify files are copied to `/usr/local/apache2/htdocs/`
5. **Port Forwarding**: Ensure Vast.AI port mappings match the configuration
6. **DNS Issues**: Verify DNS records are properly configured and propagated
7. **Environment Variables**: Check that `.env` files have correct values

### **Getting Help:**
- Check Apache error logs: `sudo tail -f /usr/local/apache2/logs/error_log`
- Check backend logs: `tail -f /tmp/backend.log`
- Verify port forwarding in Vast.AI dashboard
- Check DNS propagation with `nslookup dev.ugaanlabs.com`
- Review browser console for frontend errors
- Check backend process: `ps aux | grep python`
