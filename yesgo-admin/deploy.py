#!/usr/bin/env python3
"""Deploy YesGo Admin to production server"""
import paramiko, time, sys

HOST = "47.112.156.183"
USER = "root"
PASSWORD = "$8kL#mP2@666"
ADMIN_DIR = "/home/web/twdanao/admin"
NGINX_CONF = "/etc/nginx/conf.d/twdanao.88yldh.com.conf"
NGINX_BACKEND_CONF = "/etc/nginx/conf.d/twdanaob.88yldh.com.conf"

def run():
    print("Connecting...")
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PASSWORD, timeout=60, banner_timeout=60)
    time.sleep(3)
    
    try:
        # 1. Check current state
        print("1. Checking server state...")
        _, o, _ = c.exec_command("ls /etc/nginx/conf.d/", timeout=30)
        confs = o.read().decode().strip()
        print(f"   Nginx conf.d: {confs}")
        
        _, o, _ = c.exec_command("ls /home/web/twdanao/", timeout=30)
        webdir = o.read().decode().strip()
        print(f"   Web root: {webdir}")
        
        # 2. Check if admin files exist
        _, o, _ = c.exec_command(f"ls {ADMIN_DIR}/index.html 2>/dev/null && echo OK || echo MISSING", timeout=30)
        print(f"   Admin index: {o.read().decode().strip()}")
        
        # 3. Find frontend Nginx config
        _, o, _ = c.exec_command(f"ls {NGINX_CONF} 2>/dev/null && echo EXISTS || echo MISSING", timeout=30)
        has_conf = o.read().decode().strip()
        print(f"   Frontend Nginx conf: {has_conf}")
        
        if has_conf == "EXISTS":
            # 4. Update Nginx to serve admin SPA from /admin/ path
            _, o, _ = c.exec_command(f"cat {NGINX_CONF}", timeout=30)
            current_conf = o.read().decode()
            print(f"   Current conf ({len(current_conf)} bytes)")
            
            # Check if admin location already exists
            if "location /admin/" in current_conf:
                print("   Admin location already configured!")
            else:
                # Add admin location before the closing brace
                admin_block = '''
    # YesGo Admin Dashboard (SPA)
    location /admin/ {
        alias /home/web/twdanao/admin/;
        try_files $uri $uri/ /admin/index.html;
        index index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 30d;
            add_header Cache-Control "public, immutable";
        }
    }
'''
                # Insert before the last closing brace
                conf_lines = current_conf.rstrip().split('\n')
                insert_pos = len(conf_lines) - 1  # before last }
                for i in range(len(conf_lines) - 1, -1, -1):
                    if conf_lines[i].strip() == '}':
                        insert_pos = i
                        break
                
                new_conf = '\n'.join(conf_lines[:insert_pos]) + admin_block + '\n' + '\n'.join(conf_lines[insert_pos:])
                
                # Write new config
                sftp = c.open_sftp()
                with sftp.open(NGINX_CONF, 'w') as f:
                    f.write(new_conf)
                sftp.close()
                print("   Updated Nginx config with /admin/ location")
                
                # Test and reload
                _, o, _ = c.exec_command("nginx -t 2>&1 && nginx -s reload", timeout=30)
                print(f"   Nginx reload: {o.read().decode().strip()}")
        
        print("\nDone! Admin deployed to: https://twdanao.88yldh.com/admin/")
        
    finally:
        c.close()

if __name__ == '__main__':
    run()
