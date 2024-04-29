import mongoose from "mongoose";
import { Comment } from "../models/comment.model.js";
import { User } from "../models/user.model.js";
import { Video } from "../models/video.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getVideoComments = asyncHandler(async (req, res) => {
  //TODO: get all comments for a video
  const { videoId } = req.params;
  const { page = 1, limit = 10 } = req.query;
  if (!videoId) throw new ApiError(401, "Please provide a video id");

  const matchCondition = {
    video: new mongoose.Types.ObjectId(videoId),
  };

  const aggregateData = Comment.aggregate([
    {
      $match: matchCondition,
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "ownerDetails",
        pipeline:[
          {
            $project:{
              username:1,
              avatar:1
            }
          }
        ]
      },
    },
    {
      $addFields: {
        owner: {
          $arrayElemAt: ["$ownerDetails", 0],
        },
      },
    },
    {
      $project: {
        ownerDetails: 0,
      },
    },
  ]);
  const options = {
    skip: (page - 1) * limit,
    limit,
    page
  };

  const comments = await Comment.aggregatePaginate(aggregateData, options).then(async (content)=>{
    if(content.length === 0) return res.status(200).json(new ApiResponse(200,{},"NO comments found on this video"))

    return res.status(200).json(new ApiResponse(200,content,"Comments fetched Successfully"))
  })

});

const addComment = asyncHandler(async (req, res) => {
  // TODO: add a comment to a video
  const { videoId } = req.params;
  const { content } = req.body;
  const userId = req.user._id;
  if (!videoId) throw new ApiError(401, "Please provide a video id");

  if (!content) throw new ApiError(401, "Please Add some comment");

  const user = await User.findById(userId);

  if (!user) throw new ApiError(401, "User not found");

  const video = await Video.findById(videoId);

  if (!video) throw new ApiError(401, "Video not found");

  const comment = await Comment.create({
    owner: user,
    video,
    content,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, comment, "Comment successfull"));
});

const updateComment = asyncHandler(async (req, res) => {
  // TODO: update a comment
});

const deleteComment = asyncHandler(async (req, res) => {
  // TODO: delete a comment
  const { commentId } = req.body;
  if (!commentId) throw new ApiError(401, "Please provide a comment id");

  const comment = await Comment.findByIdAndDelete(commentId)

  return res.status(200).json(new ApiResponse(200,{},"Comment Deleted Successfully!!"))
});

export { getVideoComments, addComment, updateComment, deleteComment };
