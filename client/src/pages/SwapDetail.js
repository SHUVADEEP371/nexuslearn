import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import toast from 'react-hot-toast';
import { 
  ArrowLeft, 
  Star, 
  MessageSquare, 
  Calendar, 
  User,
  Check,
  X
} from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

const SwapDetail = () => {
  const { id } = useParams();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [swap, setSwap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingData, setRatingData] = useState({
    rating: 5,
    comment: ''
  });

  const fetchSwap = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(`/swaps/${id}`);
      setSwap(response.data);
    } catch (error) {
      console.error('Error fetching swap:', error);
      toast.error('Failed to load swap details');
      navigate('/swaps');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    fetchSwap();
  }, [fetchSwap]);

  const handleAccept = async () => {
    try {
      await api.put(`/swaps/${id}/accept`);
      toast.success('Swap request accepted!');
      fetchSwap();
    } catch (error) {
      console.error('Error accepting swap:', error);
      toast.error('Failed to accept swap request');
    }
  };

  const handleReject = async () => {
    try {
      await api.put(`/swaps/${id}/reject`);
      toast.success('Swap request rejected');
      fetchSwap();
    } catch (error) {
      console.error('Error rejecting swap:', error);
      toast.error('Failed to reject swap request');
    }
  };

  const handleComplete = async () => {
    try {
      await api.put(`/swaps/${id}/complete`);
      toast.success('Swap marked as completed!');
      fetchSwap();
    } catch (error) {
      console.error('Error completing swap:', error);
      toast.error('Failed to complete swap');
    }
  };

  const handleCancel = async () => {
    try {
      await api.put(`/swaps/${id}/cancel`);
      toast.success('Swap request cancelled');
      fetchSwap();
    } catch (error) {
      console.error('Error cancelling swap:', error);
      toast.error('Failed to cancel swap request');
    }
  };

  const handleSubmitRating = async () => {
    try {
      await api.post(`/swaps/${id}/rate`, ratingData);
      toast.success('Rating submitted successfully!');
      setShowRatingModal(false);
      setRatingData({ rating: 5, comment: '' });
      fetchSwap();
      // Notify Browse page to refresh users
      window.dispatchEvent(new Event('refresh-users'));
    } catch (error) {
      console.error('Error submitting rating:', error);
      toast.error(error.response?.data?.message || 'Failed to submit rating');
    }
  };

  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;

    for (let i = 0; i < fullStars; i++) {
      stars.push(<Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />);
    }

    if (hasHalfStar) {
      stars.push(<Star key="half" className="w-4 h-4 fill-yellow-400 text-yellow-400" />);
    }

    const emptyStars = 5 - Math.ceil(rating);
    for (let i = 0; i < emptyStars; i++) {
      stars.push(<Star key={`empty-${i}`} className="w-4 h-4 text-gray-300" />);
    }

    return stars;
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { color: 'badge-warning', text: 'Pending' },
      accepted: { color: 'badge-success', text: 'Accepted' },
      rejected: { color: 'badge-danger', text: 'Rejected' },
      completed: { color: 'badge-primary', text: 'Completed' },
      cancelled: { color: 'badge-secondary', text: 'Cancelled' }
    };
    
    const config = statusConfig[status] || { color: 'badge-secondary', text: status };
    return <span className={`badge ${config.color}`}>{config.text}</span>;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isRequester = swap?.requester._id === currentUser?._id;
  const isRecipient = swap?.recipient._id === currentUser?._id;
  const canRate = swap?.status === 'completed' && 
    ((isRequester && swap?.requesterRating && !swap.requesterRating.rating) || 
     (isRecipient && swap?.recipientRating && !swap.recipientRating.rating));

  if (loading) {
    return <LoadingSpinner size="lg" className="py-20" />;
  }

  if (!swap) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">Swap not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center bg-white pt-8 px-2 animate-fade-in">
      {/* Header */}
      <div className="mb-8 w-full max-w-4xl">
        <button
          onClick={() => navigate('/swaps')}
          className="flex items-center text-brand-mauve hover:text-brand-plum mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to My Swaps
        </button>
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-brand-plum">Swap Details</h1>
          {getStatusBadge(swap.status)}
        </div>
      </div>

      {/* Swap Information */}
      <div className="card mb-8">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Requester */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <User className="w-5 h-5 mr-2" />
              {isRequester ? 'You' : swap.requester.name}
            </h3>
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-medium text-green-800 mb-2">Offering:</h4>
              <p className="text-green-700">{swap.offeredSkill.name}</p>
              {swap.offeredSkill.description && (
                <p className="text-sm text-green-600 mt-1">{swap.offeredSkill.description}</p>
              )}
            </div>
            <div className="bg-blue-50 p-4 rounded-lg mt-4">
              <h4 className="font-medium text-blue-800 mb-2">Requesting:</h4>
              <p className="text-blue-700">{swap.requestedSkill.name}</p>
              {swap.requestedSkill.description && (
                <p className="text-sm text-blue-600 mt-1">{swap.requestedSkill.description}</p>
              )}
            </div>
          </div>

          {/* Recipient */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <User className="w-5 h-5 mr-2" />
              {isRecipient ? 'You' : swap.recipient.name}
            </h3>
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-800 mb-2">Offering:</h4>
              <p className="text-blue-700">{swap.requestedSkill.name}</p>
              {swap.requestedSkill.description && (
                <p className="text-sm text-blue-600 mt-1">{swap.requestedSkill.description}</p>
              )}
            </div>
            <div className="bg-green-50 p-4 rounded-lg mt-4">
              <h4 className="font-medium text-green-800 mb-2">Requesting:</h4>
              <p className="text-green-700">{swap.offeredSkill.name}</p>
              {swap.offeredSkill.description && (
                <p className="text-sm text-green-600 mt-1">{swap.offeredSkill.description}</p>
              )}
            </div>
          </div>
        </div>

        {/* Message */}
        {swap.message && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-start space-x-2">
              <MessageSquare className="w-4 h-4 text-gray-400 mt-0.5" />
              <div>
                <h4 className="font-medium text-gray-900 mb-1">Message from {swap.requester.name}:</h4>
                <p className="text-gray-700">{swap.message}</p>
              </div>
            </div>
          </div>
        )}

        {/* Dates */}
        <div className="mt-6 flex flex-wrap gap-4 text-sm text-gray-600">
          <div className="flex items-center">
            <Calendar className="w-4 h-4 mr-1" />
            Created {formatDate(swap.createdAt)}
          </div>
          {swap.scheduledDate && (
            <div className="flex items-center">
              <Calendar className="w-4 h-4 mr-1" />
              Scheduled {formatDate(swap.scheduledDate)}
            </div>
          )}
          {swap.completedDate && (
            <div className="flex items-center">
              <Check className="w-4 h-4 mr-1" />
              Completed {formatDate(swap.completedDate)}
            </div>
          )}
        </div>
      </div>

      {/* Ratings */}
      {((swap.requesterRating && swap.requesterRating.rating) || (swap.recipientRating && swap.recipientRating.rating)) &&
        <div className="card mb-8">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Ratings</h3>
          <div className="space-y-4">
            {swap.requesterRating && swap.requesterRating.rating && swap.requester && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900">
                    {swap.requester.name}'s rating
                  </h4>
                  <div className="flex items-center">
                    {renderStars(swap.requesterRating.rating)}
                  </div>
                </div>
                {swap.requesterRating.comment && (
                  <p className="text-gray-700">{swap.requesterRating.comment}</p>
                )}
                <p className="text-xs text-gray-500 mt-2">
                  {formatDate(swap.requesterRating.date)}
                </p>
              </div>
            )}
            {swap.recipientRating && swap.recipientRating.rating && swap.recipient && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900">
                    {swap.recipient.name}'s rating
                  </h4>
                  <div className="flex items-center">
                    {renderStars(swap.recipientRating.rating)}
                  </div>
                </div>
                {swap.recipientRating.comment && (
                  <p className="text-gray-700">{swap.recipientRating.comment}</p>
                )}
                <p className="text-xs text-gray-500 mt-2">
                  {formatDate(swap.recipientRating.date)}
                </p>
              </div>
            )}
          </div>
        </div>
      }

      {/* Actions */}
      <div className="flex justify-center space-x-4">
        {swap.status === 'pending' && (
          <>
            {isRecipient ? (
              <>
                <button
                  onClick={handleAccept}
                  className="btn btn-success"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Accept
                </button>
                <button
                  onClick={handleReject}
                  className="btn btn-danger"
                >
                  <X className="w-4 h-4 mr-2" />
                  Reject
                </button>
              </>
            ) : (
              <button
                onClick={handleCancel}
                className="btn btn-danger"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel Request
              </button>
            )}
          </>
        )}

        {swap.status === 'accepted' && (
          <button
            onClick={handleComplete}
            className="btn btn-primary"
          >
            <Check className="w-4 h-4 mr-2" />
            Mark as Completed
          </button>
        )}

        {canRate && (
          <button
            onClick={() => setShowRatingModal(true)}
            className="btn btn-primary"
          >
            <Star className="w-4 h-4 mr-2" />
            Rate This Swap
          </button>
        )}
      </div>

      {/* Rating Modal */}
      {showRatingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Rate This Swap</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rating
                  </label>
                  <div className="flex items-center space-x-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setRatingData({ ...ratingData, rating: star })}
                        className={`w-8 h-8 ${
                          star <= ratingData.rating
                            ? 'text-yellow-400 fill-current'
                            : 'text-gray-300'
                        }`}
                      >
                        <Star className="w-full h-full" />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Comment (optional)
                  </label>
                  <textarea
                    value={ratingData.comment}
                    onChange={(e) => setRatingData({ ...ratingData, comment: e.target.value })}
                    className="input"
                    rows="3"
                    placeholder="Share your experience..."
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowRatingModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitRating}
                  className="btn btn-primary"
                >
                  Submit Rating
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SwapDetail;