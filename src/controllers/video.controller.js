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
      $match: matchCondition,
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
    {
      $lookup:{
        from:"likes",
        localField: "_id",
        foreignField: "video",
        as: "likes",
      }
    },
    {
      $addFields:{
        likes:{
          $size: "$likes"
        }
      }
    },
    {
      $sort:{
        createdAt:-1
      }
    }
  ];

  const userVideos = Video.aggregate(aggregateObject);

  // Construct query
  const options = {
    page,
    limit,
  };

  // Perform query with pagination
  const videos = await Video.aggregatePaginate(userVideos, options);

  if (videos.docs.length === 0) {
    res.status(200).json(new ApiResponse(200, {}, "Videos fetched successfully"));
  }

  res.status(200).json(new ApiResponse(200, videos, "Videos fetched successfully"));
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
  const userId = req.user?._id;

  // Fetch the video by ID
  const video = await Video.findById(videoId);
  if (!video) throw new ApiError(404, "Video not found");

  // Fetch the user by ID
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  // Check if the video is already in the user's watch history
  const alreadyWatched = user.watchHistory.some((entry) => entry.video.toString() === videoId);

  // Increment views if the video is not already watched
  if (!alreadyWatched) {
    await Video.findByIdAndUpdate(videoId, {
      $inc: { views: 1 },
    });

    // Add video to watch history with the current date and time
    user.watchHistory.push({ video: videoId, watchedAt: new Date() });
    await user.save();
  }

  // Aggregation pipeline to fetch video details along with owner and likes information
  const videoData = await Video.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(videoId),
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
            $lookup: {
              from: "subscriptions",
              localField: "_id",
              foreignField: "channel",
              as: "subscribers",
            },
          },
          {
            $project: {
              _id: 1,
              fullName: 1,
              avatar: 1,
              username: 1,
              subscribers: {
                $size: "$subscribers",
              },
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "video",
        as: "likes",
      },
    },
    {
      $addFields: {
        owner_details: {
          $arrayElemAt: ["$owner_details", 0],
        },
        isLiked: {
          $cond: {
            if: {
              $in: [req.user._id, "$likes.likedBy"],
            },
            then: true,
            else: false,
          },
        },
        totalLikes: {
          $size: "$likes",
        },
      },
    },
    {
      $project: {
        likes: 0,
      },
    },
  ]);

  return res.status(200).json(new ApiResponse(200, videoData, "Video found"));
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
