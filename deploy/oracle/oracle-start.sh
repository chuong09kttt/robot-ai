#!/bin/bash

# Đợi Oracle Cloud Agent
sleep 5

# Cấu hình OCI CLI
oci setup config --config-file /home/node/.oci/config \
    --user-id $ORACLE_USER_ID \
    --fingerprint $ORACLE_FINGERPRINT \
    --key-content "$ORACLE_PRIVATE_KEY" \
    --region $ORACLE_REGION \
    --tenancy-id $ORACLE_TENANCY_ID

# Mount Object Storage (dùng FUSE)
mkdir -p /mnt/oci-bucket
oci os bucket mount --bucket-name robot-data /mnt/oci-bucket

# Start backend với Oracle adapter
NODE_ENV=production \
CLOUD_PLATFORM=oracle \
ORACLE_BUCKET=robot-storage \
ORACLE_COMPUTE_ID=$ORACLE_COMPUTE_ID \
node server.js
