import mongoose, { isValidObjectId } from "mongoose";
import { User } from "../models/user.model.js";
import { Subscription } from "../models/subscription.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const toggleSubscription = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  // TODO: toggle subscription
  const subscriber = await User.findById(req.user._id);
  const channel = await User.findById(channelId);

  if (!subscriber || !channel) {
    throw new ApiError(404, "User or channel not found");
  }
  const subscription = await Subscription.findOne({
    subscriber,
    channel,
  });

  if (subscription) {
    await Subscription.findByIdAndDelete(subscription._id);
    return res.status(200).json(new ApiResponse(true, "Subscription removed"));
  }

  const newSubscriber = new Subscription({
    subscriber,
    channel,
  });

  await newSubscriber.save();
  res.status(200).json(new ApiResponse(true, "Subscription added"));
});

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
  const { channelId } = req.params;

  const subscribers = await Subscription.find({channel:new mongoose.Types.ObjectId(channelId)})

  // if(!subscribers) throw new ApiError(404,"No Channel found with this id!!")

  return res.status(200).json(new ApiResponse(true, subscribers, "Subscribers fetched"))

});

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
  const { subscriberId } = req.params;
});

export { toggleSubscription, getUserChannelSubscribers, getSubscribedChannels };
