import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadToCloudinary } from "../utils/cloudinary.js";
import { User } from "../models/user.model.js";

const getAllVideos = asyncHandler(async (req, res) => {
  let { page, limit, query = "", sortBy, sortType, id } = req.query;
  page = parseInt(page);
  limit = parseInt(limit);

  const matchCondition = {
    $and: [
      {
        $or: [
          { title: { $regex: query, $options: "i" } },
          { description: { $regex: query, $options: "i" } },
        ],
      },
      {
        isPublished: true,
      },
    ],
  };

  if (id) {
    matchCondition.owner = new mongoose.Types.ObjectId(id);
  }

  const aggregateObject = [
    {
      $match: {
        isPublished: true,
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner_details",
        pipeline: [
          {
            $project: {
              _id: 1,
              fullName: 1,
              avatar: 1,
              username: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        owner: {
          $arrayElemAt: ["$owner_details", 0],
        },
      },
    },
  ];

  const userVideos = Video.aggregate(aggregateObject);

  // Construct query
  const options = {
    page,
    limit,
    skip: (page - 1) * limit,
    limit: parseInt(limit),
  }; // Example condition, adjust as needed

  // Perform query with pagination
  const videos = await Video.aggregatePaginate(userVideos, options).then(
    async (video) => {
      if (video?.length === 0) throw new ApiError(404, "Videos not found");

      return res
        .status(200)
        .json(new ApiResponse(200, video, "Videos fetched successfully"));
    }
  );
});

const publishAVideo = asyncHandler(async (req, res) => {
  const videoPath = req.files?.videoFile[0]?.path;
  if (!videoPath) throw new ApiError(404, "Video not available");

  const cloudVideo = await uploadToCloudinary(videoPath);
  if (!cloudVideo)
    throw new ApiError(
      500,
      "Something went wrong while uploading to cloudinary"
    );
  const videoFile = cloudVideo.url;

  const duration = cloudVideo.duration;

  const thumbnailPath = req.files?.thumbnail[0]?.path;
  if (!thumbnailPath) throw new ApiError(404, "Thumbnail not available");

  const cloudThumbnail = await uploadToCloudinary(thumbnailPath);

  if (!cloudThumbnail)
    throw new ApiError(
      500,
      "Something went wrong while uploading to cloudinary"
    );
  const thumbnail = cloudThumbnail.url;
  const { title, description } = req.body;
  const owner = req.user;
  // TODO: get video, upload to cloudinary, create video

  const video = await Video.create({
    title,
    description,
    owner,
    videoFile,
    thumbnail,
    duration,
  });
  if (!video) throw new ApiError(500, "Internal Server Error");

  return res
    .status(200)
    .json(new ApiResponse(200, "Video uploaded successfully", video));
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: get video by id
  const video = await Video.findById(videoId);
  if (!video) throw new ApiError(404, "Video not found");

  const userId = req.user?._id;
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  if(!user.watchHistory.includes(videoId)){
    await User.findByIdAndUpdate(userId, {
      $addToSet: { watchHistory: videoId },
      new:true
    });
  }

  await Video.findByIdAndUpdate(videoId,{
    $inc: { views: 1 },
    new:true
  })

  return res.status(200).json(new ApiResponse(200, "Video found", video));
});

const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: update video details like title, description, thumbnail
});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: delete video
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};
