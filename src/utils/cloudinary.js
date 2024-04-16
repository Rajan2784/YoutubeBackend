import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_SECRET_KEY,
});

const uploadToCloudinary = async (filePath) => {
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

const deleteFromCloudinary = async (filePath) => {
  if (!filePath) return null;
  try {
    const response = await cloudinary.uploader.destroy(filePath, {
      resource_type: "auto",
    });
    return response;
  } catch (error) {
    return null;
  }
};

export { uploadToCloudinary, deleteFromCloudinary };
