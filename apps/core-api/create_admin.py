import os
import psycopg2
import bcrypt
from dotenv import load_dotenv

load_dotenv()
db_url = os.getenv("DATABASE_URL")

def create_admin():
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    email = "admin@quant.com"
    password = "admin"
    
    # Hash password using bcrypt
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
    
    # Check if exists
    cur.execute("SELECT id FROM users WHERE email = %s", (email,))
    if cur.fetchone():
        print(f"User {email} already exists. Updating password...")
        cur.execute("UPDATE users SET password_hash = %s, role = 'admin' WHERE email = %s", (hashed, email))
    else:
        print(f"Creating user {email}...")
        cur.execute("INSERT INTO users (email, password_hash, name, role) VALUES (%s, %s, %s, %s)", 
                    (email, hashed, "Master Admin", "admin"))
        
    conn.commit()
    cur.close()
    conn.close()
    print("Admin user successfully created/updated!")

if __name__ == "__main__":
    create_admin()
