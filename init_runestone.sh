#!/bin/bash

################################################################################
# Runestone First-Time Setup Wizard
################################################################################
#
# This script automates the initialization of a Runestone server for first-time
# users. It guides you through:
#   - Validating prerequisites (Docker, Git)
#   - Configuring the .env file with BOOK_PATH
#   - Pulling Docker images and starting services
#   - Initializing the database
#   - Optionally adding and building your first book
#   - Optionally creating a course
#
# REQUIREMENTS:
#   - Docker Desktop with Docker Compose 2.20.2+ (current: 2.38.2)
#   - Git (only required if you want to clone book repositories)
#   - For Windows: WSL2 with this script run from WSL terminal
#
# USAGE:
#   Standalone (one-line install - no repo clone needed):
#     curl -fsSL https://raw.githubusercontent.com/RunestoneInteractive/rs/main/init_runestone.sh | bash
#
#   Traditional (from cloned repo):
#     git clone https://github.com/RunestoneInteractive/rs.git
#     cd rs
#     ./init_runestone.sh
#
# NOTE: Standalone mode downloads only configuration files (docker-compose.yml, 
#       sample.env). Application code runs inside pre-built Docker images from 
#       ghcr.io. Files are created in your current working directory.
#
# The script will prompt you for required information and guide you through
# each step of the setup process.
#
################################################################################

set -e  # Exit on error

# Color codes for output formatting
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly CYAN='\033[0;36m'
readonly BOLD='\033[1m'
readonly NC='\033[0m' # No Color

# Log file for debugging
readonly LOG_FILE="init_runestone.log"

# Platform detection globals
IS_WSL=false
IS_MACOS=false
IS_LINUX=false

################################################################################
# Utility Functions
################################################################################

# Print functions for wizard-style output
print_header() {
    echo -e "\n${BOLD}${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}${BLUE}  $1${NC}"
    echo -e "${BOLD}${BLUE}═══════════════════════════════════════════════════════════════${NC}\n"
}

print_step() {
    echo -e "${CYAN}${BOLD}==>${NC} ${BOLD}$1${NC}"
}

print_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

print_error() {
    echo -e "${RED}[X] ERROR:${NC} $1" >&2
}

print_warning() {
    echo -e "${YELLOW}[!] WARNING:${NC} $1"
}

print_info() {
    echo -e "${BLUE}[i]${NC} $1"
}

# Log to file and console
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Prompt for yes/no with default
prompt_yes_no() {
    local prompt="$1"
    local default="${2:-y}"
    local response
    
    if [[ "$default" == "y" ]]; then
        prompt="$prompt [Y/n]: "
    else
        prompt="$prompt [y/N]: "
    fi
    
    read -r -p "$(echo -e ${BOLD}${prompt}${NC})" response
    response="${response:-$default}"
    
    [[ "$response" =~ ^[Yy]$ ]]
}

# Prompt for numbered menu choice
prompt_menu() {
    local prompt="$1"
    local -n result_var=$2  # nameref to output variable
    shift 2
    local options=("$@")
    local user_choice
    
    while true; do
        read -r -p "$(echo -e ${BOLD}${prompt}${NC})" user_choice
        
        # Validate choice is a number within range
        if [[ "$user_choice" =~ ^[0-9]+$ ]] && [ "$user_choice" -ge 1 ] && [ "$user_choice" -le "${#options[@]}" ]; then
            result_var=$user_choice
            return 0
        else
            echo "Invalid choice. Please enter a number between 1 and ${#options[@]}."
        fi
    done
}

# Prompt for input with optional default (using nameref for return value)
prompt_input() {
    local prompt="$1"
    local default="$2"
    local -n result_var=$3  # nameref to output variable
    local response
    
    if [[ -n "$default" ]]; then
        prompt="$prompt [$default]: "
    else
        prompt="$prompt: "
    fi
    
    read -r -p "$(echo -e ${BOLD}${prompt}${NC})" response
    result_var="${response:-$default}"
}

################################################################################
# File Management
################################################################################

# Download a file from GitHub's raw content
download_file_from_github() {
    local filename="$1"
    local target_path="$2"
    local base_url="https://raw.githubusercontent.com/RunestoneInteractive/rs/main"
    local file_url="${base_url}/${filename}"
    
    log "Attempting to download ${filename} from ${file_url}"
    
    # Try curl first
    if command -v curl &> /dev/null; then
        if curl -fsSL "${file_url}" -o "${target_path}" 2>> "$LOG_FILE"; then
            # Verify file was downloaded and is not empty
            if [[ -s "${target_path}" ]]; then
                log "Successfully downloaded ${filename} using curl"
                return 0
            else
                log "Downloaded file ${filename} is empty"
                rm -f "${target_path}"
                return 1
            fi
        else
            log "Failed to download ${filename} using curl"
        fi
    fi
    
    # Fallback to wget
    if command -v wget &> /dev/null; then
        if wget -qO "${target_path}" "${file_url}" 2>> "$LOG_FILE"; then
            # Verify file was downloaded and is not empty
            if [[ -s "${target_path}" ]]; then
                log "Successfully downloaded ${filename} using wget"
                return 0
            else
                log "Downloaded file ${filename} is empty"
                rm -f "${target_path}"
                return 1
            fi
        else
            log "Failed to download ${filename} using wget"
        fi
    fi
    
    # Both methods failed
    log "Failed to download ${filename} - no working download tool"
    return 1
}

# Ensure required configuration files exist
ensure_required_files() {
    local has_compose=false
    local has_sample=false
    local in_standalone_mode=false
    
    # Check if files already exist
    if [[ -f docker-compose.yml ]]; then
        has_compose=true
        log "Found existing docker-compose.yml"
    fi
    
    if [[ -f sample.env ]]; then
        has_sample=true
        log "Found existing sample.env"
    fi
    
    # If both files exist, we're in traditional mode
    if $has_compose && $has_sample; then
        print_info "Configuration files found - running in traditional mode"
        log "Running in traditional mode (files exist)"
        return 0
    fi
    
    # At least one file is missing - enter standalone mode
    in_standalone_mode=true
    log "Entering standalone mode - downloading missing files"
    
    echo ""
    print_header "Standalone Mode"
    print_info "Running in standalone mode - configuration files will be downloaded"
    echo ""
    echo "Files will be created in: ${BOLD}$(pwd)${NC}"
    echo ""
    echo "The following files will be downloaded from the official Runestone repository:"
    if ! $has_compose; then
        echo "  - docker-compose.yml (Docker service configuration)"
    fi
    if ! $has_sample; then
        echo "  - sample.env (Environment variable template)"
    fi
    echo ""
    print_info "Your Runestone server will run using pre-built Docker images"
    print_info "No source code repository clone is required"
    echo ""
    
    # Download missing files
    local download_failed=false
    
    if ! $has_compose; then
        print_step "Downloading docker-compose.yml..."
        if download_file_from_github "docker-compose.yml" "./docker-compose.yml"; then
            print_success "Downloaded docker-compose.yml"
        else
            print_error "Failed to download docker-compose.yml"
            download_failed=true
        fi
    fi
    
    if ! $has_sample; then
        print_step "Downloading sample.env..."
        if download_file_from_github "sample.env" "./sample.env"; then
            print_success "Downloaded sample.env"
        else
            print_error "Failed to download sample.env"
            download_failed=true
        fi
    fi
    
    # Check if any downloads failed
    if $download_failed; then
        echo ""
        print_error "Failed to download required files"
        echo ""
        echo "This may be due to:"
        echo "  - Network connectivity issues"
        echo "  - GitHub being unavailable"
        echo "  - Missing curl/wget tools"
        echo ""
        echo "Manual download instructions:"
        echo "  curl -fsSL https://raw.githubusercontent.com/RunestoneInteractive/rs/main/docker-compose.yml -o docker-compose.yml"
        echo "  curl -fsSL https://raw.githubusercontent.com/RunestoneInteractive/rs/main/sample.env -o sample.env"
        echo ""
        echo "Or clone the repository:"
        echo "  git clone https://github.com/RunestoneInteractive/rs.git"
        echo "  cd rs"
        echo "  ./init_runestone.sh"
        echo ""
        exit 1
    fi
    
    echo ""
    print_success "Configuration files downloaded successfully"
    echo ""
    print_info "You can inspect these files before continuing if needed"
    echo ""
    
    log "Standalone mode setup complete"
    return 0
}

################################################################################
# Platform Detection
################################################################################

detect_platform() {
    print_step "Detecting platform..."
    
    # Primary method: Check for wslinfo command (most reliable for WSL)
    if command -v wslinfo &> /dev/null && wslinfo --version &> /dev/null; then
        IS_WSL=true
        local wsl_version=$(wslinfo --version 2>/dev/null | head -n 1 || echo "unknown")
        print_success "Running on Windows WSL"
        log "Platform: Windows WSL (detected via: wslinfo --version: $wsl_version)"
    # Fallback methods for older WSL versions or edge cases
    elif grep -qi microsoft /proc/version 2>/dev/null || \
         grep -qi wsl /proc/version 2>/dev/null || \
         [[ -n "${WSL_DISTRO_NAME}" ]] || \
         [[ -n "${WSLENV}" ]] || \
         [[ "$(uname -r)" == *Microsoft* ]] || \
         [[ "$(uname -r)" == *microsoft* ]] || \
         [[ "$(uname -r)" == *WSL* ]]; then
        IS_WSL=true
        print_success "Running on Windows WSL"
        log "Platform: Windows WSL (detected via: fallback methods - /proc/version, WSL_DISTRO_NAME, WSLENV, or uname)"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        IS_MACOS=true
        print_success "Running on macOS"
        log "Platform: macOS"
    elif [[ "$OSTYPE" == "linux-gnu"* ]] || [[ "$OSTYPE" == "linux" ]]; then
        IS_LINUX=true
        print_success "Running on Linux"
        log "Platform: Linux"
    else
        print_error "Unknown platform: $OSTYPE"
        log "Platform detection failed: OSTYPE=$OSTYPE, uname=$(uname -a)"
        exit 1
    fi
}

################################################################################
# Prerequisite Validation
################################################################################

check_docker() {
    print_step "Checking Docker installation..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed or not in PATH"
        echo ""
        echo "Please install Docker Desktop:"
        echo "  https://docs.docker.com/compose/install/"
        echo ""
        if $IS_WSL; then
            echo "For Windows WSL: Install Docker Desktop for Windows"
            echo "  Make sure WSL integration is enabled in Docker Desktop settings"
        fi
        exit 1
    fi
    
    # Check if Docker daemon is running
    if ! docker info &> /dev/null; then
        print_error "Docker daemon is not running"
        echo ""
        echo "Please start Docker Desktop and try again"
        exit 1
    fi
    
    print_success "Docker is installed and running"
    log "Docker check: OK"
}

check_docker_compose() {
    print_step "Checking Docker Compose version..."
    
    if ! docker compose version &> /dev/null; then
        print_error "Docker Compose (v2) is not available"
        echo ""
        echo "Please install Docker Compose 2.20.2 or later:"
        echo "  https://docs.docker.com/compose/install/"
        exit 1
    fi
    
    local compose_version
    compose_version=$(docker compose version --short 2>/dev/null || echo "0.0.0")
    
    print_success "Docker Compose version: $compose_version"
    log "Docker Compose version: $compose_version"
    
    # Check minimum version (2.20.2)
    local min_version="2.20.2"
    if ! printf '%s\n' "$min_version" "$compose_version" | sort -V -C 2>/dev/null; then
        print_warning "Docker Compose version is older than recommended ($min_version)"
        echo "  Current: $compose_version"
        echo "  Consider updating to the latest version"
        echo ""
        if ! prompt_yes_no "Continue anyway?"; then
            echo "Exiting..."
            exit 1
        fi
    fi
}

check_docker_group() {
    # Only check on native Linux (not WSL, not macOS)
    # Docker Desktop on WSL and macOS handles permissions differently
    if ! $IS_LINUX || $IS_WSL; then
        log "Skipping docker group check (not native Linux)"
        return 0
    fi
    
    print_step "Checking Docker group membership..."
    
    # Check if user is in docker group
    if groups | grep -q docker || id -nG | grep -q docker; then
        print_success "User is in docker group"
        log "Docker group check: OK"
        return 0
    fi
    
    # User is not in docker group
    print_warning "You are not in the docker group"
    echo ""
    echo "Without docker group membership, you may need to run Docker commands with sudo."
    echo ""
    echo "To add yourself to the docker group, run these commands:"
    echo -e "  ${CYAN}sudo usermod -aG docker \$USER${NC}"
    echo -e "  ${CYAN}newgrp docker${NC}"
    echo ""
    echo "Or log out and back in for the change to take effect."
    echo ""
    log "Docker group check: WARNING - user not in docker group"
    
    # Non-fatal - allow user to continue with sudo if they want
    if ! prompt_yes_no "Continue anyway?" "y"; then
        echo ""
        echo "Please add yourself to the docker group and run this script again."
        exit 1
    fi
    
    echo ""
}

check_git() {
    print_step "Checking Git installation..."
    
    if ! command -v git &> /dev/null; then
        print_error "Git is not installed or not in PATH"
        echo ""
        log "Git check: FAILED - not installed"
        return 1
    fi
    
    local git_version
    git_version=$(git --version | cut -d' ' -f3)
    print_success "Git version: $git_version"
    log "Git version: $git_version"
    return 0
}

validate_prerequisites() {
    print_header "Validating Prerequisites"
    
    detect_platform
    check_docker
    check_docker_compose
    check_docker_group
    ensure_required_files
    
    print_success "All prerequisites validated"
    echo ""
}

################################################################################
# Environment Configuration
################################################################################

backup_env() {
    if [[ -f .env ]]; then
        local timestamp
        timestamp=$(date +%Y%m%d_%H%M%S)
        local backup_file=".env.backup.$timestamp"
        
        print_step "Backing up existing .env file..."
        cp .env "$backup_file"
        print_success "Backed up to: $backup_file"
        log "Backed up .env to $backup_file"
    fi
}

create_env_from_sample() {
    print_step "Creating .env file from sample.env..."
    
    if [[ ! -f sample.env ]]; then
        print_error "sample.env not found in current directory"
        echo "Please run this script from the rs directory"
        exit 1
    fi
    
    cp sample.env .env
    print_success "Created .env file"
    log "Created .env from sample.env"
}

convert_windows_path() {
    local input_path="$1"
    local -n output_var=$2  # nameref to output variable
    
    log "convert_windows_path called with: $input_path"
    log "IS_WSL=$IS_WSL, IS_LINUX=$IS_LINUX, IS_MACOS=$IS_MACOS"
    
    # Check if it looks like a Windows path
    # Pattern 1: C:\path or C:/path (with slash after colon)
    # Pattern 2: C:path (backslashes were consumed by bash - no slash after colon)
    if [[ "$input_path" =~ ^[A-Za-z]: ]]; then
        log "Windows path pattern detected"
        
        # Extract drive letter (first character) and convert to lowercase using bash
        local drive_letter="${input_path:0:1}"
        drive_letter="${drive_letter,,}"  # Bash 4+ lowercase conversion
        
        # Extract the rest of the path (after drive letter and colon)
        local rest_of_path="${input_path:2}"
        
        # Remove leading slash or backslash if present
        rest_of_path="${rest_of_path#/}"
        rest_of_path="${rest_of_path#\\}"
        
        # Replace all backslashes with forward slashes
        rest_of_path="${rest_of_path//\\//}"
        
        # Remove any duplicate slashes
        rest_of_path="${rest_of_path//\/\//\/}"
        
        # Construct WSL path
        local wsl_path="/mnt/${drive_letter}/${rest_of_path}"
        
        # Remove trailing slash if present
        wsl_path="${wsl_path%/}"
        
        log "Converted to WSL path: $wsl_path"
        
        echo ""
        print_info "Detected Windows path - converting to WSL format:"
        echo "  Windows: $input_path"
        echo "  WSL:     $wsl_path"
        echo ""
        
        if ! $IS_WSL; then
            print_warning "Not running in WSL - path conversion may not work correctly"
            echo "  For Windows, please run this script from a WSL terminal"
            echo "  Current platform: IS_WSL=$IS_WSL, IS_LINUX=$IS_LINUX, IS_MACOS=$IS_MACOS"
            echo ""
        fi
        
        # Set output variable to converted path
        output_var="$wsl_path"
    else
        # Not a Windows path, return as-is
        log "Not a Windows path, returning as-is: $input_path"
        output_var="$input_path"
    fi
}

prompt_for_book_path() {
    local -n result_var=$1  # nameref to output variable
    
    print_step "Configuring BOOK_PATH..."
    echo ""
    echo "BOOK_PATH is the directory where your Runestone books will be stored."
    echo "This should be a path on your host machine (not inside Docker)."
    echo ""
    
    if $IS_WSL; then
        echo "You can provide paths in either format:"
        echo "  Windows format: C:\\Projects\\runestone\\books"
        echo "  WSL format:     /mnt/c/Projects/runestone/books"
        echo "  Linux format:   /home/username/runestone/books"
        echo ""
        print_info "Windows paths will be automatically converted to WSL format"
        echo ""
    elif $IS_LINUX || $IS_MACOS; then
        echo "Examples:"
        echo "  /home/username/runestone/books    (Linux)"
        echo "  /Users/username/runestone/books   (macOS)"
        echo "  ~/runestone/books                 (relative to home)"
        echo ""
    fi
    
    local user_input_path
    prompt_input "Enter the full path to your books directory" "" user_input_path
    
    if [[ -z "$user_input_path" ]]; then
        print_error "BOOK_PATH cannot be empty"
        exit 1
    fi
    
    # Convert Windows paths to WSL format automatically
    local original_path="$user_input_path"
    local converted_path
    convert_windows_path "$user_input_path" converted_path
    
    # Expand ~ to $HOME if present
    converted_path="${converted_path/#\~/$HOME}"
    
    # Log the final path for debugging
    log "BOOK_PATH after conversion: $converted_path (original: $original_path)"
    
    # Check if directory exists
    if [[ ! -d "$converted_path" ]]; then
        print_warning "Directory does not exist: $converted_path"
        
        # If it was a Windows path, provide helpful context
        if [[ "$original_path" != "$converted_path" ]]; then
            echo ""
            echo "The Windows path was converted to: $converted_path"
            echo "This directory will be created in WSL and should map to your Windows directory."
            echo ""
        fi
        
        if prompt_yes_no "Create this directory?"; then
            if mkdir -p "$converted_path" 2>/dev/null; then
                print_success "Created directory: $converted_path"
                log "Created BOOK_PATH: $converted_path"
                
                # Verify it's accessible
                if [[ ! -w "$converted_path" ]]; then
                    print_warning "Directory created but may not be writable"
                    echo "  You may need to check permissions"
                fi
            else
                print_error "Failed to create directory: $converted_path"
                echo ""
                echo "Possible issues:"
                echo "  - Invalid path format"
                echo "  - Insufficient permissions"
                if [[ "$original_path" =~ ^[A-Za-z]:[/\\] ]]; then
                    echo "  - For Windows paths, the drive must be accessible in WSL"
                    echo "  - Try accessing the drive first: cd /mnt/c"
                fi
                exit 1
            fi
        else
            print_error "BOOK_PATH must exist. Please create it and run the script again."
            exit 1
        fi
    else
        print_success "Directory exists: $converted_path"
        log "Verified BOOK_PATH exists: $converted_path"
    fi
    
    # Set the result via nameref
    result_var="$converted_path"
}

update_env_file() {
    local book_path="$1"
    
    print_step "Updating .env file with BOOK_PATH..."
    
    # Use sed to replace the BOOK_PATH line
    # This handles both commented and uncommented lines
    if grep -q "^BOOK_PATH=" .env; then
        # Replace existing uncommented line
        sed -i.bak "s|^BOOK_PATH=.*|BOOK_PATH=$book_path|" .env
    elif grep -q "^#.*BOOK_PATH=" .env; then
        # Uncomment and replace
        sed -i.bak "s|^#.*BOOK_PATH=.*|BOOK_PATH=$book_path|" .env
    else
        # Add new line
        echo "BOOK_PATH=$book_path" >> .env
    fi
    
    rm -f .env.bak
    print_success "Updated BOOK_PATH in .env"
    log "Set BOOK_PATH=$book_path in .env"
}

configure_environment() {
    print_header "Configuring Environment"
    
    # Show detected platform for debugging
    log "configure_environment: IS_WSL=$IS_WSL, IS_LINUX=$IS_LINUX, IS_MACOS=$IS_MACOS"
    
    backup_env
    create_env_from_sample
    
    local book_path
    prompt_for_book_path book_path
    update_env_file "$book_path"
    
    echo ""
    print_success "Environment configuration complete"
    echo ""
}

################################################################################
# Docker Service Initialization
################################################################################

pull_images() {
    print_step "Pulling Docker images..."
    echo ""
    print_info "This may take several minutes on first run..."
    echo ""
    
    if docker compose pull; then
        print_success "Docker images pulled successfully"
        log "Docker images pulled"
    else
        print_error "Failed to pull Docker images"
        exit 1
    fi
}

start_database() {
    print_step "Starting database service..."
    
    if docker compose up -d db; then
        print_success "Database service started"
        log "Database service started"
    else
        print_error "Failed to start database service"
        exit 1
    fi
    
    # Wait for database to be ready
    print_info "Waiting for database to be ready..."
    sleep 5
    
    # Try to check if db is healthy (with timeout)
    local max_attempts=30
    local attempt=0
    while [ $attempt -lt $max_attempts ]; do
        if docker compose exec -T db pg_isready -U runestone &> /dev/null; then
            print_success "Database is ready"
            log "Database ready after $attempt attempts"
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 1
        echo -n "."
    done
    
    echo ""
    print_warning "Could not verify database status, proceeding anyway..."
}

init_database() {
    print_step "Initializing database..."
    echo ""
    
    # Check if database is already initialized by checking for the boguscourse
    print_info "Checking if database is already initialized..."
    if docker compose exec -T db psql -U runestone -d runestone_dev -tAc "SELECT 1 FROM courses WHERE course_name='boguscourse' LIMIT 1;" 2>/dev/null | grep -q "1"; then
        echo ""
        print_warning "Database appears to be already initialized (test data exists)"
        echo ""
        echo "Please choose an option:"
        echo "  1. Skip initialization and continue"
        echo "  2. Reset database (WARNING: destroys all data)"
        echo "  3. Exit script"
        echo ""
        
        local choice
        prompt_menu "Enter your choice (1-3): " choice "Skip initialization" "Reset database" "Exit"
        
        case $choice in
            1)
                print_success "Skipping database initialization"
                log "Database initialization skipped - already initialized"
                return 0
                ;;
            2)
                print_step "Resetting database..."
                echo ""
                print_warning "This will destroy all existing data!"
                if prompt_yes_no "Are you sure you want to reset the database?" "n"; then
                    print_info "Stopping services and removing volumes..."
                    docker compose down -v
                    echo ""
                    print_info "Starting database service..."
                    docker compose up -d db
                    echo ""
                    print_info "Waiting for database to be ready..."
                    sleep 5
                    
                    # Continue to initialization below
                    print_success "Database reset complete"
                    log "Database reset and ready for initialization"
                else
                    print_error "Database reset cancelled. Exiting."
                    exit 1
                fi
                ;;
            3)
                echo ""
                print_info "Exiting script. You can manually handle the database with:"
                echo "  docker compose down -v  # Remove volumes"
                echo "  docker compose up -d db # Restart database"
                echo "  ./init_runestone.sh     # Re-run this script"
                echo ""
                exit 0
                ;;
        esac
    fi
    
    print_info "Creating tables and test users..."
    echo ""
    
    if docker compose run --rm rsmanage rsmanage initdb; then
        print_success "Database initialized successfully"
        log "Database initialized"
    else
        print_error "Failed to initialize database"
        echo ""
        print_info "If you see 'duplicate key' errors, the database may already be initialized."
        print_info "Run: docker compose down -v  # to reset and start fresh"
        exit 1
    fi
}

start_all_services() {
    print_step "Starting all Runestone services..."
    echo ""
    
    if docker compose up -d; then
        print_success "All services started"
        log "All services started"
    else
        print_error "Failed to start services"
        exit 1
    fi
    
    # Give services time to start
    print_info "Waiting for services to initialize..."
    sleep 5
}

verify_server_running() {
    print_step "Verifying server is running..."
    
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -s -f http://localhost > /dev/null 2>&1; then
            print_success "Server is responding at http://localhost"
            log "Server verified running"
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 1
        echo -n "."
    done
    
    echo ""
    print_warning "Could not verify server is responding"
    print_info "Check logs with: docker compose logs -f"
}

initialize_services() {
    print_header "Initializing Docker Services"
    
    pull_images
    echo ""
    start_database
    echo ""
    init_database
    echo ""
    start_all_services
    echo ""
    verify_server_running
    echo ""
}

################################################################################
# Book Management
################################################################################

prompt_add_book() {
    echo ""
    print_header "Book Setup (Optional)"
    echo ""
    echo "Would you like to add a book to your Runestone server now?"
    echo "You can also do this later using: docker compose run --rm rsmanage rsmanage addbookauthor"
    echo ""
    
    prompt_yes_no "Add a book now?" "y"
}

prompt_book_details() {
    local -n repo_result=$1  # nameref for book_repo
    local -n name_result=$2  # nameref for book_name
    
    print_step "Book Details"
    echo ""
    
    # Provide suggestions for common books
    echo "Popular Runestone books:"
    echo "  - overview: https://github.com/RunestoneInteractive/overview.git"
    echo "  - thinkcspy: https://github.com/RunestoneInteractive/thinkcspy.git"
    echo "  - pythonds: https://github.com/RunestoneInteractive/pythonds.git"
    echo ""
    
    local input_repo
    prompt_input "Enter the Git repository URL for the book" "" input_repo
    
    if [[ -z "$input_repo" ]]; then
        print_error "Repository URL cannot be empty"
        return 1
    fi
    
    # Try to extract book name from repo URL (e.g., overview from overview.git)
    # Use bash parameter expansion instead of basename
    local suggested_name
    suggested_name="${input_repo##*/}"  # Remove everything up to last /
    suggested_name="${suggested_name%.git}"  # Remove .git extension
    
    echo ""
    local input_name
    prompt_input "Enter the book name/document-id (basecourse)" "$suggested_name" input_name
    
    if [[ -z "$input_name" ]]; then
        print_error "Book name cannot be empty"
        return 1
    fi
    
    # Set results via nameref
    repo_result="$input_repo"
    name_result="$input_name"
}

clone_book() {
    local book_repo="$1"
    local book_path="$2"
    local -n cloned_name_result=$3  # nameref for result
    
    print_step "Cloning book repository..."
    echo ""
    
    # Get book name from repo using bash parameter expansion
    local book_name
    book_name="${book_repo##*/}"  # Remove everything up to last /
    book_name="${book_name%.git}"  # Remove .git extension
    
    local target_dir="$book_path/$book_name"
    
    if [[ -d "$target_dir" ]]; then
        print_warning "Directory already exists: $target_dir"
        if ! prompt_yes_no "Skip cloning and use existing directory?"; then
            return 1
        fi
        print_info "Using existing directory"
    else
        if git clone "$book_repo" "$target_dir"; then
            print_success "Book cloned to: $target_dir"
            log "Cloned $book_repo to $target_dir"
        else
            print_error "Failed to clone repository"
            return 1
        fi
    fi
    
    # Return result via nameref
    cloned_name_result="$book_name"
}

add_book_to_db() {
    local book_name="$1"
    
    print_step "Adding book to database..."
    echo ""
    echo "You will be prompted for:"
    echo "  - document-id or basecourse: $book_name"
    echo "  - Runestone username of author/admin: testuser1"
    echo ""
    print_info "Press Enter to continue..."
    read -r
    
    # Run the addbookauthor command interactively
    # We'll provide the inputs via echo pipe
    if echo -e "${book_name}\ntestuser1" | docker compose run --rm rsmanage rsmanage addbookauthor; then
        print_success "Book added to database"
        log "Added book $book_name to database"
    else
        print_error "Failed to add book to database"
        return 1
    fi
}

build_book() {
    local book_name="$1"
    
    print_step "Building book..."
    echo ""
    
    local is_pretex=false
    if prompt_yes_no "Is this a PreTeXt book?" "n"; then
        is_pretex=true
    fi
    
    echo ""
    print_info "Building $book_name... This may take several minutes..."
    echo ""
    
    if $is_pretex; then
        if docker compose run --rm rsmanage rsmanage build --ptx "$book_name"; then
            print_success "Book built successfully"
            log "Built PreTeXt book: $book_name"
        else
            print_error "Failed to build book"
            return 1
        fi
    else
        if docker compose run --rm rsmanage rsmanage build "$book_name"; then
            print_success "Book built successfully"
            log "Built book: $book_name"
        else
            print_error "Failed to build book"
            return 1
        fi
    fi
}

setup_book() {
    if ! prompt_add_book; then
        return 0
    fi

    # Check for Git now that we know we need to clone a book
    if ! check_git; then
        print_warning "Skipping book setup"
        echo "Please either:"
        echo "  1. Install Git: https://git-scm.com/downloads"
        echo "  2. Manually download your book repository and place it in your BOOK_PATH"
        return 1
    fi
    echo ""
    
    # Get book details
    local book_repo
    local book_name
    if ! prompt_book_details book_repo book_name; then
        print_warning "Skipping book setup"
        return 1
    fi
    
    # Get BOOK_PATH from .env using read loop to avoid command substitution
    local book_path
    while IFS='=' read -r key value; do
        if [[ "$key" == "BOOK_PATH" ]]; then
            book_path="$value"
            break
        fi
    done < <(grep "^BOOK_PATH=" .env)
    
    # Clone the book
    if ! clone_book "$book_repo" "$book_path" _unused; then
        print_error "Failed to clone book"
        return 1
    fi
    
    echo ""
    
    # Add to database
    if ! add_book_to_db "$book_name"; then
        print_warning "Failed to add book to database, but repository is cloned"
        return 1
    fi
    
    echo ""
    
    # Build the book
    if ! build_book "$book_name"; then
        print_warning "Failed to build book, but it's added to database"
        return 1
    fi
    
    # Show book URL
    echo ""
    print_success "Your book is ready!"
    echo ""
    echo -e "${BOLD}Access your book at:${NC}"
    echo -e "  ${CYAN}http://localhost/ns/books/published/${book_name}/index.html${NC}"
    echo ""
}

################################################################################
# Course Management
################################################################################

prompt_add_course() {
    echo ""
    print_header "Course Setup (Optional)"
    echo ""
    echo "Would you like to create a course for students?"
    echo "A base course was already created with your book."
    echo "You can create additional courses later with: docker compose run --rm rsmanage rsmanage addcourse"
    echo ""
    
    prompt_yes_no "Create a course now?" "n"
}

create_course() {
    print_step "Creating course..."
    echo ""
    echo "The rsmanage addcourse command will prompt you for course details."
    echo ""
    print_info "Press Enter to continue..."
    read -r
    
    if docker compose run --rm rsmanage rsmanage addcourse; then
        print_success "Course created successfully"
        log "Course created"
    else
        print_warning "Failed to create course or cancelled"
        return 1
    fi
}

setup_course() {
    if prompt_add_course; then
        create_course
    fi
}

################################################################################
# Final Summary
################################################################################

show_final_summary() {
    print_header "Setup Complete!"
    
    echo -e "${GREEN}${BOLD}[OK] Runestone server is up and running!${NC}"
    echo ""
    
    echo -e "${BOLD}Access your server:${NC}"
    echo -e "  ${CYAN}http://localhost${NC}"
    echo ""
    
    echo -e "${BOLD}Default test credentials:${NC}"
    echo "  Username: testuser1"
    echo "  Password: xxx"
    echo ""
    
    echo -e "${BOLD}Useful commands:${NC}"
    echo "  Stop server:        docker compose stop"
    echo "  Start server:       docker compose start"
    echo "  View logs:          docker compose logs -f"
    echo "  Restart services:   docker compose restart"
    echo "  Shut down:          docker compose down"
    echo ""
    
    echo -e "${BOLD}Additional management:${NC}"
    echo "  Add another book:   docker compose run --rm rsmanage rsmanage addbookauthor"
    echo "  Build a book:       docker compose run --rm rsmanage rsmanage build <bookname>"
    echo "  Create course:      docker compose run --rm rsmanage rsmanage addcourse"
    echo "  Add instructor:     docker compose run --rm rsmanage rsmanage addinstructor"
    echo "  All commands:       docker compose run --rm rsmanage rsmanage --help"
    echo ""
    
    echo -e "${BOLD}Documentation:${NC}"
    echo "  See docs/source/running.rst for more information"
    echo ""
    
    echo -e "${BOLD}Logs and debugging:${NC}"
    echo "  Setup log: $LOG_FILE"
    echo ""
}

################################################################################
# Error Handling and Cleanup
################################################################################

cleanup_on_error() {
    echo ""
    print_error "Setup interrupted or failed"
    echo ""
    echo "Partial setup may have been completed. Check $LOG_FILE for details."
    echo ""
    echo "To resume or retry:"
    echo "  1. Review any error messages above"
    echo "  2. Fix any issues (e.g., Docker not running, missing directories)"
    echo "  3. Run the script again"
    echo ""
    echo "To clean up and start fresh:"
    echo "  docker compose down"
    echo "  rm .env (or restore from backup)"
    
    # Provide additional context if in standalone mode
    if [[ -f docker-compose.yml ]] && [[ -f sample.env ]]; then
        echo ""
        echo "Downloaded configuration files:"
        echo "  - docker-compose.yml"
        echo "  - sample.env"
        echo "These files will be reused if you run the script again."
    fi
    
    echo ""
    exit 1
}

# Trap errors and interrupts
trap cleanup_on_error ERR INT TERM

################################################################################
# Main Flow
################################################################################

main() {
    # Clear log file
    echo "Runestone Setup Started at $(date)" > "$LOG_FILE"
    
    # Welcome message
    print_header "Runestone Server Setup Wizard"
    echo "This script will guide you through setting up your Runestone server."
    echo "The process will:"
    echo "  1. Validate prerequisites (Docker)"
    echo "  2. Configure your environment (.env file)"
    echo "  3. Pull Docker images and start services"
    echo "  4. Initialize the database"
    echo "  5. Optionally help you add and build your first book"
    echo ""
    
    if ! prompt_yes_no "Ready to begin?" "y"; then
        echo "Setup cancelled."
        exit 0
    fi
    
    # Execute setup steps
    validate_prerequisites
    configure_environment
    initialize_services
    setup_book
    setup_course
    
    # Show final summary
    show_final_summary
    
    log "Setup completed successfully"
}

# Run main function
main "$@"
