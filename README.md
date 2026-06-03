# Rabbittize PaaS Simulation - MERN Stack Demo

This repository contains a full-stack demo application designed to run on top of the **Rabbittize / RabbittWatch PaaS Simulation platform**. It demonstrates end-to-end cloud resource integration (connection wiring) across AWS EC2, S3, and RDS PostgreSQL.

## Project Structure
- `/client`: Frontend Single Page Application built with React and Vite.
- `/server`: Node.js Express backend API connecting to PostgreSQL (RDS) and AWS S3 storage.

---

## 🗺️ How to Setup on Your Canvas (The System Architecture)

To deploy this application, create the following nodes on your product's canvas and draw connections as described below:

### 1. The Nodes (Configure on Canvas)
*   **EC2 Instance Node (AWS)**
    *   **Service Type:** `ec2`
    *   **GitHub Configuration (Click Node Settings):**
        *   **Git URL:** `https://github.com/<your-username>/<your-repo-name>.git` (The URL of this repo after you upload it)
        *   **Branch:** `main` (or `master`)
        *   **Project Type:** `mern`
        *   **Frontend Directory:** `client`
        *   **Backend Directory:** `server`
        *   **Start Command:** `npm run start`
        *   **Backend Port:** `5000`
        *   **App Port:** `80` (Nginx acts as reverse proxy mapping port 80 to the frontend dist build, and `/api` to the backend)
*   **S3 Bucket Node (AWS)**
    *   **Service Type:** `s3`
    *   **Name:** `sim-media-bucket` (or any name)
*   **RDS PostgreSQL Instance Node (AWS)**
    *   **Service Type:** `rds`
    *   **Engine:** `postgres`
    *   **Database Name:** `simdb`
    *   **Username:** `dbadmin`
    *   **Password:** `P@ssw0rd1234!`
    *   **Port:** `5432`

### 2. The Connections (Wire Them)
Draw arrows/connections between your nodes:
1.  **EC2 Node $\rightarrow$ S3 Bucket Node:** Connects the virtual machine to S3. This automatically provisions IAM instance profiles allowing read/write operations and injects the `S3_BUCKET_NAME` environment variable into the VM.
2.  **EC2 Node $\rightarrow$ RDS PostgreSQL Node:** Connects the virtual machine to the database. This opens the database security group port 5432 to allow connections from the EC2 instance, and injects database environment variables (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`) into the VM.

---

## 🚀 How to Deploy

1.  **Push Code to GitHub:** Initialize a git repository in this folder, commit all files, and push it to your GitHub account.
2.  **Verify Git URL in EC2 Node:** Ensure the Git URL in your canvas EC2 Node points to your new public GitHub repository.
3.  **Click Deploy:** Hit **Deploy** on the product canvas.
4.  **Access App:** Once the Terraform deployment completes, click on the generated EC2 Public IP address or standard application URL. You will see the live frontend board!
