import mongoose, { isValidObjectId } from "mongoose";
import { Like } from "../models/like.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";

const toggleVideoLike = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const userId = req.user?._id;
  //TODO: toggle like on video
  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(401, "Video not found");
  }

  const likedBy = await User.findById(userId);
  if (!likedBy) {
    throw new ApiError(401, "User not found");
  }

  const like = await Like.findOne({ video, likedBy });
  if (like) {
    await Like.findByIdAndDelete(like._id);
    return res.status(200).json(new ApiResponse(true, "Like removed"));
  }
  const newLike = new Like({
    video,
    likedBy,
  });
  await newLike.save();
  return res.status(200).json(new ApiResponse(true, "Like added"));
});

const toggleCommentLike = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  //TODO: toggle like on comment
});

const toggleTweetLike = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;
  //TODO: toggle like on tweet
});

const getLikedVideos = asyncHandler(async (req, res) => {
  //TODO: get all liked videos
  const userId = req.user?._id;
  const likedVideos = await Like.aggregate(
    [
      {
        $match:{
          likedBy:userId
        }
      },
      {
        $lookup: {
          from: "videos",
          localField: "video",
          foreignField: "_id",
          as: "likedVideo",
          pipeline:[
            {
              $lookup:{
                from:"users",
                localField:"owner",
                foreignField:"_id",
                as:"owner"
              }
            },
            {
              $addFields:{
                owner:{
                  $arrayElemAt:["$owner",0]
                }
              }
            },
          ]
        }
      },
    ]
  )
  return res.status(200).json(new ApiResponse(true, {likedVideos}, "Liked videos"));
});

export { toggleCommentLike, toggleTweetLike, toggleVideoLike, getLikedVideos };
