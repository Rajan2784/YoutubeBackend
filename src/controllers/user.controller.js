import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import { deleteFromCloudinary, uploadToCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshtoken = user.generateRefreshToken();

    user.refreshtoken = refreshtoken;
    await user.save({ validateBeforeSave: false });

    return {
      accessToken,
      refreshtoken,
    };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating refresh and access token"
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  const { fullName, email, username, password } = req.body;

  if (
    [fullName, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fileds are required");
  }

  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "User with email or username is already existed");
  }
  const avatarLocal = req.files?.avatar[0]?.path;
  console.log(avatarLocal);
  let coverImageLocal;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocal = req.files.coverImage[0]?.path;
  }
  if (!avatarLocal) {
    throw new ApiError(409, "Avatar is required");
  }

  const avatar = await uploadToCloudinary(avatarLocal);
  const coverImage = await uploadToCloudinary(coverImageLocal);

  if (!avatar) {
    throw new ApiError(400, "Avatar is required");
  }

  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshtoken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering user");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, createdUser, "User created Successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, username, password } = req.body;

  // Validation
  if (!(email || username)) {
    throw new ApiError(400, "Email or username are required");
  }

  const user = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (!user) {
    throw new ApiError(401, "Invalid credentials");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid Password");
  }

  const { accessToken, refreshtoken } = await generateAccessAndRefreshTokens(
    user._id
  );

  // Remove sensitive data from response
  const loggedInUser = await User.findByIdAndUpdate(user._id, {
    refreshtoken,
  }).select("-password -refreshtoken");

  const option = {
    httpOnly: true,
    secure: true,
  };
  res
    .status(200)
    .cookie("accessToken", accessToken, option)
    .cookie("refreshToken", refreshtoken, option)
    .json(
      new ApiResponse(
        200,
        {
          loggedInUser,
          accessToken,
          refreshtoken,
        },
        "Logged in successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    }
  );
  const option = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", option)
    .clearCookie("refreshtoken", option)
    .json(new ApiResponse(200, null, "Logged out Successfully"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;
  if (!incomingRefreshToken) throw new ApiError(401, "Unauthorized request");

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );
    const userId = new mongoose.Types.ObjectId(decodedToken?._id);
    const user = await User.findById(userId);

    if (!user) {
      throw new ApiError(401, "Invalid user");
    }

    if (incomingRefreshToken !== user?.refreshtoken) {
      throw new ApiError(401, "Refresh token is expired or used");
    }

    const options = {
      httpOnly: true,
      secure: true,
    };
    const { accessToken, refreshtoken } =
      await generateAccessAndRefreshTokens(user._id);
    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshtoken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshtoken },
          "Access Token refreshed"
        )
      );
  } catch (error) {
    throw new ApiError("Something went wrong");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const user = await User.findById(req.user?._id);
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
  if (!isPasswordCorrect) {
    throw new ApiError(401, "Incorrect current password')");
  }
  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, "Password has been changed"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "current user fetched successfully"));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  // Check if avatar file is present
  if (!req.file) {
    throw new ApiError(400, "Avatar file is missing");
  }

  const avatarLocalPath = req.file.path;

  try {
    const currentUser = await User.findById(req.user._id);
    if (!currentUser) {
      throw new ApiError(404, "User not found");
    }
    
    const oldAvatar = currentUser.avatar;

    // Upload new avatar and delete old one
    const avatar = await uploadToCloudinary(avatarLocalPath);
    if (!avatar || !avatar.url) {
      throw new ApiError(400, "Error while uploading the avatar");
    }

    // Update user avatar in the database
    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        $set: {
          avatar: avatar.url,
        },
      },
      { new: true }
    ).select("-password");

    // Delete old avatar from Cloudinary
    if (oldAvatar) {
      const deleteResponse = await deleteFromCloudinary(oldAvatar);
      if (!deleteResponse) {
        console.error("Failed to delete old avatar from Cloudinary");
      }
    }

    // Return response
    return res.status(200).json(new ApiResponse(200, user, "Avatar image updated successfully"));
  } catch (error) {
    // Cleanup: Delete local file if it exists
    if (avatarLocalPath) {
      await fs.promises.unlink(avatarLocalPath).catch((unlinkError) => {
        console.error('Error while deleting local avatar file:', unlinkError);
      });
    }

    // Rethrow error to be handled by the asyncHandler
    throw error;
  }
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverLocalPath = req.file?.path;
  if (coverLocalPath) {
    throw new ApiError(400, "CoverImage file is missing");
  }
  try {
    const currentUser = await User.findById(req.user?._id)
    const oldCoverImage = currentUser.coverImage
    const coverImage = await uploadToCloudinary(coverLocalPath);

    if (!coverImage.url) {
      throw new ApiError(400, "Error while uploading the cover image");
    }
    
    const user = await User.findByIdAndUpdate(
      req.user?._id,
      {
        $set: {
          coverImage: coverImage.url,
        },
      },
      { new: true }
    ).select("-password");

    if (oldCoverImage) {
      const deleteResponse = await deleteFromCloudinary(oldCoverImage);
      if (!deleteResponse) {
        console.error("Failed to delete old avatar from Cloudinary");
      }
    }
  
    return res
      .status(200)
      .json(new ApiResponse(200, user, "Cover image updated successfully"));
  } catch (error) {
    if (coverLocalPath) {
      await fs.promises.unlink(coverLocalPath).catch((unlinkError) => {
        console.error('Error while deleting local avatar file:', unlinkError);
      });
    }

    // Rethrow error to be handled by the asyncHandler
    throw error;
  }
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;
  if (!username?.trim()) {
    throw new ApiError(400, "Username is missing");
  }

  const channel = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase(),
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "_id",
        foreignField: "owner",
        as: "userVideos",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "ownerDetails",
              pipeline:[
                {
                  $project:{
                    _id:1,
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
        ],
      },
    },
    {
      $addFields: {
        subscribersCount: {
          $size: "$subscribers",
        },
        channelsSubscribedToCount: {
          $size: "$subscribedTo",
        },
        totalVideos: {
          $size: "$userVideos",
        },
        isSubscribed: {
          $cond: {
            if: {
              $in: [req.user?._id, "$subscribers.subscriber"],
            },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        fullName: 1,
        username: 1,
        email: 1,
        subscribersCount: 1,
        channelsSubscribedToCount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
        totalVideos: 1,
        userVideos: 1,
      },
    },
  ]);
  if (!channel?.length) {
    throw new ApiError(404, "Channel not found");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, channel[0], "User channel found successfully"));
});

const getWatchHistory = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(userId),
      },
    },
    {
      $unwind: "$watchHistory"
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory.video",
        foreignField: "_id",
        as: "videoDetails"
      }
    },
    {
      $addFields: {
        "video": { $arrayElemAt: ["$videoDetails", 0] }
      }
    },
    {
      $lookup: {
        from: "users",
        localField: "video.owner",
        foreignField: "_id",
        as: "ownerDetails",
        pipeline:[
          {
            $project:{
              _id:1,
              username:1,
              avatar:1
            }
          }
        ]
      }
    },
    {
      $addFields: {
        "video.owner": { $arrayElemAt: ["$ownerDetails", 0] }
      }
    },
    {
      $project: {
        "_id": "$watchHistory._id",
        "video": 1,
        "watchedAt": "$watchHistory.watchedAt"
      }
    }
  ]);

  return res.status(200).json(new ApiResponse(200, user, "Watch history fetched successfully"));
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
  getWatchHistory,
};
