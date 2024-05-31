import mongoose from "mongoose";
import { Video } from "../models/video.model.js";
import { Subscription } from "../models/subscription.model.js";
import { Like } from "../models/like.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";

const getChannelStats = asyncHandler(async (req, res) => {
  // TODO: Get the channel stats like total video views, total subscribers, total videos, total likes etc.

  const allDetails = await Subscription.aggregate([
    {
      $match: {
        channel: new mongoose.Types.ObjectId(req.user._id),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "channel",
        foreignField: "_id",
        as: "userChannel",
        pipeline: [
          {
            $lookup: {
              from: "videos",
              localField: "_id",
              foreignField: "owner",
              as: "channelVideos",
              pipeline: [
                {
                  $lookup: {
                    from: "likes",
                    localField: "_id",
                    foreignField: "video",
                    as: "videoLikes",
                  },
                },
                {
                  $addFields: {
                    likeCount: { $size: "$videoLikes" },
                  },
                },
              ],
            },
          },
          {
            $unwind: "$channelVideos",
          },
          {
            $group: {
              _id: null,
              totalViews: { $sum: "$channelVideos.views" },
              totalLikes: { $sum: "$channelVideos.likeCount" },
            },
          },
        ],
      },
    },
    {
      $unwind: "$userChannel",
    },
    {
      $group: {
        _id: "$_id",
        userChannel: { $first: "$userChannel" },
        totalSubscribers: { $sum: 1 },
      },
    },
    {
      $addFields: {
        totalViews: "$userChannel.totalViews",
        totalLikes: "$userChannel.totalLikes",
        totalSubscribers: "$totalSubscribers",
      },
    },
    {
      $project: {
        userChannel: 0,
      },
    },
  ]);

  return res
    .status(200)
    .json(new ApiResponse(200, allDetails, "Got the stats"));
});

const getChannelVideos = asyncHandler(async (req, res) => {
  // TODO: Get all the videos uploaded by the channel
});

export { getChannelStats, getChannelVideos };
