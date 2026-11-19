# ************************************************
# Git Utilities for displaying commit information
# ************************************************
# This module provides utilities for getting git commit information
# to help with debugging and version tracking in Runestone books.

import os
import subprocess
from typing import Optional


def get_git_commit_hash() -> Optional[str]:
    """
    Get the current git commit hash.
    
    This function attempts to get the git commit hash using multiple methods:
    1. From environment variable GIT_COMMIT_HASH (useful for CI/CD)
    2. From git command if available
    3. From .git/refs/heads/<branch> file if .git directory exists
    
    Returns:
        str: The git commit hash (short form - first 7 characters) or None if not available
    """
    # Method 1: Check environment variable (useful for CI/CD environments)
    commit_hash = os.environ.get('GIT_COMMIT_HASH')
    if commit_hash:
        return commit_hash[:7]  # Return short hash
    
    # Method 2: Try using git command
    try:
        result = subprocess.run(
            ['git', 'rev-parse', '--short', 'HEAD'],
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except (subprocess.SubprocessError, FileNotFoundError, subprocess.TimeoutExpired):
        pass
    
    # Method 3: Try reading from .git directory directly
    try:
        # Get the current branch
        git_head_file = '.git/HEAD'
        if os.path.exists(git_head_file):
            with open(git_head_file, 'r') as f:
                head_content = f.read().strip()
            
            # If HEAD contains a reference to a branch
            if head_content.startswith('ref: '):
                branch_ref = head_content[5:]  # Remove 'ref: ' prefix
                branch_file = os.path.join('.git', branch_ref)
                if os.path.exists(branch_file):
                    with open(branch_file, 'r') as f:
                        commit_hash = f.read().strip()
                    return commit_hash[:7]  # Return short hash
            else:
                # HEAD contains the commit hash directly (detached HEAD)
                return head_content[:7]
    except (OSError, IOError):
        pass
    
    return None


def get_git_commit_info() -> dict:
    """
    Get comprehensive git commit information.
    
    Returns:
        dict: Dictionary containing git information including:
            - hash: commit hash (short)
            - available: whether git info is available
            - source: source of the information (env, git_cmd, git_file)
    """
    commit_hash = None
    source = None
    
    # Try environment variable first
    if os.environ.get('GIT_COMMIT_HASH'):
        commit_hash = os.environ['GIT_COMMIT_HASH'][:7]
        source = 'env'
    else:
        # Try git command
        try:
            result = subprocess.run(
                ['git', 'rev-parse', '--short', 'HEAD'],
                capture_output=True,
                text=True,
                timeout=10
            )
            if result.returncode == 0:
                commit_hash = result.stdout.strip()
                source = 'git_cmd'
        except (subprocess.SubprocessError, FileNotFoundError, subprocess.TimeoutExpired):
            # Try reading from .git files
            try:
                git_head_file = '.git/HEAD'
                if os.path.exists(git_head_file):
                    with open(git_head_file, 'r') as f:
                        head_content = f.read().strip()
                    
                    if head_content.startswith('ref: '):
                        branch_ref = head_content[5:]
                        branch_file = os.path.join('.git', branch_ref)
                        if os.path.exists(branch_file):
                            with open(branch_file, 'r') as f:
                                commit_hash = f.read().strip()[:7]
                            source = 'git_file'
                    else:
                        commit_hash = head_content[:7]
                        source = 'git_file'
            except (OSError, IOError):
                pass
    
    return {
        'hash': commit_hash,
        'available': commit_hash is not None,
        'source': source
    }
