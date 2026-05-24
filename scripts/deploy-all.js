const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function deployToRailway() {
    console.log('🚀 Deploying to Railway...');
    try {
        await execPromise('railway login --token $RAILWAY_TOKEN');
        await execPromise('railway up --service backend');
        await execPromise('railway up --service frontend');
        console.log('✅ Railway deployment successful');
        return true;
    } catch (error) {
        console.error('❌ Railway deployment failed:', error);
        return false;
    }
}

async function deployToOracle() {
    console.log('☁️ Deploying to Oracle Cloud...');
    try {
        // Build Docker image
        await execPromise('docker build -f deploy/oracle/Dockerfile.oracle -t robot-backend .');
        
        // Push to Oracle Container Registry
        await execPromise(`
            docker tag robot-backend ${process.env.OCIR_URL}/robot-backend:latest &&
            docker push ${process.env.OCIR_URL}/robot-backend:latest
        `);
        
        // Deploy to Compute Instance
        await execPromise(`
            ssh opc@${process.env.ORACLE_INSTANCE_IP} "
                docker pull ${process.env.OCIR_URL}/robot-backend:latest &&
                docker stop robot-backend || true &&
                docker rm robot-backend || true &&
                docker run -d --name robot-backend -p 3000:3000 ${process.env.OCIR_URL}/robot-backend:latest
            "
        `);
        
        console.log('✅ Oracle deployment successful');
        return true;
    } catch (error) {
        console.error('❌ Oracle deployment failed:', error);
        return false;
    }
}

async function setupNgrok() {
    console.log('🔗 Setting up ngrok...');
    try {
        // Start ngrok tunnel
        await execPromise('nohup ngrok start --all --config deploy/ngrok/ngrok.yml &');
        
        // Get public URL
        const { stdout } = await execPromise('curl -s http://localhost:4040/api/tunnels | jq -r .tunnels[0].public_url');
        const publicUrl = stdout.trim();
        
        console.log(`✅ ngrok tunnel: ${publicUrl}`);
        
        // Save URL
        const fs = require('fs');
        fs.writeFileSync('/tmp/ngrok_url.txt', publicUrl);
        
        return publicUrl;
    } catch (error) {
        console.error('❌ ngrok setup failed:', error);
        return null;
    }
}

async function main() {
    console.log('🌍 Deploying Robot AI to Multi-Cloud...\n');
    
    // Deploy đồng thời lên Railway và Oracle
    const [railwayStatus, oracleStatus] = await Promise.all([
        deployToRailway(),
        deployToOracle()
    ]);
    
    // Setup ngrok tunnel
    const ngrokUrl = await setupNgrok();
    
    // Update DNS (optional)
    if (railwayStatus && ngrokUrl) {
        console.log('\n📡 Update your DNS or frontend to use:');
        console.log(`   Primary: https://robot-ai.railway.app`);
        console.log(`   Backup: ${ngrokUrl}`);
    }
    
    console.log('\n✅ Multi-cloud deployment complete!');
    console.log('\n📊 Monitoring URLs:');
    console.log(`   Railway: https://robot-ai.railway.app/metrics`);
    console.log(`   Oracle: http://${process.env.ORACLE_INSTANCE_IP}:3000/health`);
    console.log(`   ngrok: ${ngrokUrl}/health`);
}

// Run deployment
main().catch(console.error);
