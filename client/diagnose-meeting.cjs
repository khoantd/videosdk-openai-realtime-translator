#!/usr/bin/env node

/**
 * Diagnostic script for VideoSDK meeting creation issues
 * Tests API connectivity and token validity
 */

const fs = require('fs');
const https = require('https');

// Read environment variables
function readEnvFile() {
  try {
    const envContent = fs.readFileSync('.env', 'utf8');
    const tokenMatch = envContent.match(/VITE_APP_VIDEOSDK_TOKEN="([^"]+)"/);
    if (tokenMatch) {
      return tokenMatch[1];
    }
    throw new Error('Token not found in .env file');
  } catch (error) {
    console.error('Error reading .env file:', error.message);
    return null;
  }
}

// Test API connectivity
function testAPIConnectivity(token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.videosdk.live',
      port: 443,
      path: '/v2/rooms',
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const responseData = JSON.parse(data);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: responseData
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: data
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

// Test token validation
function testTokenValidation(token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.videosdk.live',
      port: 443,
      path: '/v2/rooms/validate/test-room-id',
      method: 'GET',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const responseData = JSON.parse(data);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: responseData
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: data
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

// Decode JWT token (without verification)
function decodeToken(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    return payload;
  } catch (error) {
    return null;
  }
}

// Main diagnostic function
async function runDiagnostics() {
  console.log('🔍 VideoSDK Meeting Creation Diagnostics');
  console.log('========================================\n');

  // 1. Check environment file
  console.log('1. Checking environment configuration...');
  const token = readEnvFile();
  if (!token) {
    console.log('   ❌ Token not found in .env file');
    console.log('   💡 Make sure VITE_APP_VIDEOSDK_TOKEN is set in .env file');
    return;
  }
  console.log('   ✅ Token found in .env file');

  // 2. Decode and analyze token
  console.log('\n2. Analyzing token...');
  const tokenData = decodeToken(token);
  if (!tokenData) {
    console.log('   ❌ Invalid token format');
    return;
  }
  
  console.log(`   Token issuer: ${tokenData.iss || 'Unknown'}`);
  console.log(`   API Key: ${tokenData.apikey || 'Unknown'}`);
  console.log(`   Permissions: ${tokenData.permissions?.join(', ') || 'None'}`);
  
  const now = Math.floor(Date.now() / 1000);
  const issuedAt = tokenData.iat || 0;
  const expiresAt = tokenData.exp || 0;
  
  console.log(`   Issued at: ${new Date(issuedAt * 1000).toISOString()}`);
  console.log(`   Expires at: ${new Date(expiresAt * 1000).toISOString()}`);
  
  if (now < issuedAt) {
    console.log('   ⚠️  Token not yet valid');
  } else if (now > expiresAt) {
    console.log('   ❌ Token has expired');
  } else {
    const timeLeft = expiresAt - now;
    const hoursLeft = Math.floor(timeLeft / 3600);
    console.log(`   ✅ Token is valid (${hoursLeft} hours left)`);
  }

  // 3. Test API connectivity
  console.log('\n3. Testing API connectivity...');
  try {
    const apiResponse = await testAPIConnectivity(token);
    console.log(`   Status code: ${apiResponse.statusCode}`);
    console.log(`   Response: ${JSON.stringify(apiResponse.data, null, 2)}`);
    
    if (apiResponse.statusCode === 200 || apiResponse.statusCode === 201) {
      console.log('   ✅ API connectivity successful');
    } else if (apiResponse.statusCode === 401) {
      console.log('   ❌ Authentication failed - check token');
    } else if (apiResponse.statusCode === 403) {
      console.log('   ❌ Authorization failed - check permissions');
    } else {
      console.log(`   ⚠️  Unexpected status code: ${apiResponse.statusCode}`);
    }
  } catch (error) {
    console.log(`   ❌ API connectivity failed: ${error.message}`);
  }

  // 4. Test token validation endpoint
  console.log('\n4. Testing token validation...');
  try {
    const validationResponse = await testTokenValidation(token);
    console.log(`   Status code: ${validationResponse.statusCode}`);
    console.log(`   Response: ${JSON.stringify(validationResponse.data, null, 2)}`);
    
    if (validationResponse.statusCode === 200) {
      console.log('   ✅ Token validation successful');
    } else if (validationResponse.statusCode === 401) {
      console.log('   ❌ Token validation failed - invalid token');
    } else {
      console.log(`   ⚠️  Unexpected validation status: ${validationResponse.statusCode}`);
    }
  } catch (error) {
    console.log(`   ❌ Token validation failed: ${error.message}`);
  }

  // 5. Provide recommendations
  console.log('\n5. Recommendations:');
  console.log('   💡 If token is expired:');
  console.log('      1. Go to https://app.videosdk.live');
  console.log('      2. Generate a new token');
  console.log('      3. Update .env file');
  console.log('');
  console.log('   💡 If API connectivity fails:');
  console.log('      1. Check internet connection');
  console.log('      2. Verify api.videosdk.live is accessible');
  console.log('      3. Check firewall settings');
  console.log('');
  console.log('   💡 If authentication fails:');
  console.log('      1. Verify token format');
  console.log('      2. Check API key permissions');
  console.log('      3. Ensure token is not expired');
  console.log('');
  console.log('   💡 For debugging:');
  console.log('      1. Check browser network tab');
  console.log('      2. Look for CORS errors');
  console.log('      3. Verify Content-Type headers');
}

// Run diagnostics
if (require.main === module) {
  runDiagnostics().catch(console.error);
}

module.exports = {
  readEnvFile,
  testAPIConnectivity,
  testTokenValidation,
  decodeToken,
  runDiagnostics
}; 