import json
import urllib.request
import urllib.error
import os
import shutil
from pathlib import Path

BASE_URL = "http://127.0.0.1:8080"
PROJECT_DIR = Path(__file__).parent.parent
SECTOR_DATA_PATH = PROJECT_DIR / "sector_data.csv"
BACKUP_PATH = PROJECT_DIR / "sector_data.csv.bak"

def send_request(url, data=None, headers=None, method="POST"):
    if headers is None:
        headers = {}
    
    req_data = None
    if data is not None:
        if isinstance(data, dict):
            req_data = json.dumps(data).encode("utf-8")
            headers["Content-Type"] = "application/json"
        else:
            req_data = data
            
    req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as res:
            return res.status, json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            err_content = json.loads(e.read().decode("utf-8"))
        except Exception:
            err_content = e.reason
        return e.code, err_content
    except Exception as e:
        return 500, str(e)

def upload_multipart(url, file_path, file_type, token):
    # Construct multipart form body
    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    CRLF = "\r\n"
    
    # Read file contents
    with open(file_path, "rb") as f:
        file_content = f.read()
        
    filename = os.path.basename(file_path)
    
    body = []
    
    # File field
    body.append(f"--{boundary}".encode("utf-8"))
    body.append(f'Content-Disposition: form-data; name="file"; filename="{filename}"'.encode("utf-8"))
    body.append(b"Content-Type: text/csv")
    body.append(b"")
    body.append(file_content)
    
    # file_type field
    body.append(f"--{boundary}".encode("utf-8"))
    body.append(f'Content-Disposition: form-data; name="file_type"'.encode("utf-8"))
    body.append(b"")
    body.append(file_type.encode("utf-8"))
    
    body.append(f"--{boundary}--".encode("utf-8"))
    body.append(b"")
    
    # Join parts with CRLF
    data = b"\r\n".join(body)
    
    headers = {
        "Content-Type": f"multipart/form-data; boundary={boundary}",
        "Authorization": f"Bearer {token}"
    }
    
    return send_request(url, data=data, headers=headers)

def run_tests():
    print("--- 1. Testing Admin Login ---")
    
    # Incorrect credentials
    status, res = send_request(f"{BASE_URL}/admin/login", {"username": "admin", "password": "wrongpassword"})
    print(f"Login (incorrect credentials): Expected 401. Got {status}, Body: {res}")
    assert status == 401
    
    # Correct credentials
    status, res = send_request(f"{BASE_URL}/admin/login", {"username": "admin", "password": "adminpassword"})
    print(f"Login (correct credentials): Expected 200. Got {status}, Body: {res}")
    assert status == 200
    assert res.get("token") == "admin-session-token"
    token = res.get("token")
    
    print("\n--- 2. Testing Authorization on Upload ---")
    
    # Create a non-csv temporary file for authorization tests
    temp_txt = PROJECT_DIR / "scratch" / "test.txt"
    with open(temp_txt, "w") as f:
        f.write("This is a temporary test file.")
        
    try:
        # Upload without token
        status, res = upload_multipart(f"{BASE_URL}/admin/upload-csv", temp_txt, "sector_data", "")
        print(f"Upload without token: Expected 401. Got {status}, Body: {res}")
        assert status == 401
        
        # Upload with invalid token
        status, res = upload_multipart(f"{BASE_URL}/admin/upload-csv", temp_txt, "sector_data", "wrong-token")
        print(f"Upload with invalid token: Expected 401. Got {status}, Body: {res}")
        assert status == 401

        print("\n--- 3. Testing File Extension Validation ---")
        
        status, res = upload_multipart(f"{BASE_URL}/admin/upload-csv", temp_txt, "sector_data", token)
        print(f"Upload non-CSV file: Expected 400. Got {status}, Body: {res}")
        assert status == 400
    finally:
        if temp_txt.exists():
            temp_txt.unlink()

    print("\n--- 4. Testing CSV Upload and File Overwriting ---")
    
    # Backup original sector_data.csv
    if SECTOR_DATA_PATH.exists():
        print(f"Backing up {SECTOR_DATA_PATH} to {BACKUP_PATH}...")
        shutil.copy2(SECTOR_DATA_PATH, BACKUP_PATH)
    else:
        print("sector_data.csv not found to backup!")
        
    try:
        # Create a modified dummy CSV file
        dummy_csv = PROJECT_DIR / "scratch" / "dummy_sector_data.csv"
        dummy_content = "Col1,Col2,Col3\n1,2,3\n4,5,6\n"
        with open(dummy_csv, "w") as f:
            f.write(dummy_content)
            
        status, res = upload_multipart(f"{BASE_URL}/admin/upload-csv", dummy_csv, "sector_data", token)
        print(f"Upload dummy CSV: Expected 200. Got {status}, Body: {res}")
        assert status == 200
        
        # Verify it overwrote the file on disk
        with open(SECTOR_DATA_PATH, "r") as f:
            disk_content = f.read()
            
        print("Comparing uploaded file contents on disk...")
        assert disk_content == dummy_content
        print("Success! File on disk matches uploaded content exactly.")
        
        if dummy_csv.exists():
            dummy_csv.unlink()
            
    finally:
        # Restore backup
        if BACKUP_PATH.exists():
            print(f"Restoring backup from {BACKUP_PATH} to {SECTOR_DATA_PATH}...")
            if SECTOR_DATA_PATH.exists():
                SECTOR_DATA_PATH.unlink()
            shutil.copy2(BACKUP_PATH, SECTOR_DATA_PATH)
            BACKUP_PATH.unlink()
            print("Restore complete.")
            
    print("\nALL TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_tests()
