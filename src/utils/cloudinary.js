import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_SECRET_KEY,
});

const extractPublicIdFromUrl = (url) => {
  // This regex extracts the part of the URL between the last '/' and before the file extension
  const match = url.match(/\/([^\/]+)(?=\.\w+$)/);
  return match ? match[1] : null;
};


const uploadToCloudinary = async (filePath) => {
  console.log(filePath)
  if (!filePath) return null;

  try {
    const response = await cloudinary.uploader.upload(filePath, {
      resource_type: "auto",
    });
    fs.unlinkSync(filePath); // delete the local file after it's uploaded to Cloudinary
    return response;
  } catch (error) {
    fs.unlinkSync(filePath);
    return null;
  }
};

const deleteFromCloudinary = async (url, resourceType) => {
  if (!url) return null;

  const publicId = extractPublicIdFromUrl(url);
  if (!publicId) return null;

  try {
    const response = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
    return response;
  } catch (error) {
    console.error("Error deleting from Cloudinary:", error);
    return null;
  }
};

export { uploadToCloudinary, deleteFromCloudinary };
