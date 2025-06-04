const dotenv = require('dotenv');
const cloudinary = require('cloudinary').v2;

// Load environment variables
dotenv.config();

console.log('Testing Cloudinary Configuration...');

// Log environment variable status
console.log('Environment Variables:');
console.log('CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME ? 'Set' : 'Not set');
console.log('CLOUDINARY_API_KEY:', process.env.CLOUDINARY_API_KEY ? 'Set' : 'Not set');
console.log('CLOUDINARY_API_SECRET:', process.env.CLOUDINARY_API_SECRET ? 'Set' : 'Not set');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// Test Cloudinary connection
async function testCloudinaryConnection() {
  try {
    console.log('Attempting to connect to Cloudinary...');
    const result = await cloudinary.api.ping();
    console.log('✅ Cloudinary connection successful:', result.status);
    return true;
  } catch (error) {
    console.error('❌ Cloudinary connection failed:', error.message);
    return false;
  }
}

// Run the test
testCloudinaryConnection().then(success => {
  if (success) {
    console.log('\nYour Cloudinary configuration is working correctly!');
    console.log('You should now be able to upload videos.');
  } else {
    console.log('\nThere was a problem with your Cloudinary configuration.');
    console.log('Please check your .env file and make sure your credentials are correct.');
    console.log('See CLOUDINARY_SETUP.md for more information.');
  }
}); 