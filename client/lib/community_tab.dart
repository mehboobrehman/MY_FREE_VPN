import 'package:flutter/material.dart';
import 'package:my_free_vpn/services/social_service.dart';

class CommunityTab extends StatefulWidget {
  const CommunityTab({Key? key}) : super(key: key);

  @override
  State<CommunityTab> createState() => _CommunityTabState();
}

class _CommunityTabState extends State<CommunityTab> {
  late Future<List<SocialPost>> _futurePosts;
  late Future<UserProfile> _futureProfile;
  final TextEditingController _postController = TextEditingController();
  final TextEditingController _tagController = TextEditingController();
  bool _isPosting = false;

  @override
  void initState() {
    super.initState();
    _refreshData();
  }

  void _refreshData() {
    setState(() {
      _futurePosts = SocialService.getPosts();
      _futureProfile = SocialService.getUserProfile();
    });
  }

  Future<void> _handleCreatePost() async {
    final text = _postController.text.trim();
    if (text.isEmpty) return;

    final tagText = _tagController.text.trim();
    final tags = tagText.isNotEmpty ? tagText.split(',').map((t) => t.trim()).where((t) => t.isNotEmpty).toList() : <String>[];

    setState(() {
      _isPosting = true;
    });

    try {
      await SocialService.createPost(text, tags);
      _postController.clear();
      _tagController.clear();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Post published successfully!')),
        );
      }
      _refreshData();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: ${e.toString()}'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isPosting = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Community Feed'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _refreshData,
            tooltip: 'Refresh Feed',
          ),
        ],
      ),
      body: Row(
        children: [
          // Main Feed Column
          Expanded(
            flex: 3,
            child: Column(
              children: [
                // Create Post Box
                Card(
                  margin: const EdgeInsets.all(12.0),
                  elevation: 2,
                  child: Padding(
                    padding: const EdgeInsets.all(12.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Text(
                          'Share with the VPN Community (Zero Setup / Pseudonymous)',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                        ),
                        const SizedBox(height: 8),
                        TextField(
                          controller: _postController,
                          maxLines: 3,
                          decoration: const InputDecoration(
                            hintText: 'What is on your mind? (Encrypted / Pseudonymous)',
                            border: OutlineInputBorder(),
                          ),
                        ),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Expanded(
                              child: TextField(
                                controller: _tagController,
                                decoration: const InputDecoration(
                                  hintText: 'Tags (comma separated, e.g. privacy, bypass)',
                                  isDense: true,
                                  border: OutlineInputBorder(),
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            ElevatedButton.icon(
                              onPressed: _isPosting ? null : _handleCreatePost,
                              icon: _isPosting
                                  ? const SizedBox(
                                      width: 16,
                                      height: 16,
                                      child: CircularProgressIndicator(strokeWidth: 2),
                                    )
                                  : const Icon(Icons.send),
                              label: const Text('Post'),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
                // Feed List
                Expanded(
                  child: FutureBuilder<List<SocialPost>>(
                    future: _futurePosts,
                    builder: (context, snapshot) {
                      if (snapshot.connectionState == ConnectionState.waiting) {
                        return const Center(child: CircularProgressIndicator());
                      } else if (snapshot.hasError) {
                        return Center(
                          child: Padding(
                            padding: const EdgeInsets.all(16.0),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(Icons.error_outline, size: 48, color: Colors.red),
                                const SizedBox(height: 8),
                                Text('Failed to load community feed:\n${snapshot.error}',
                                    textAlign: TextAlign.center),
                                const SizedBox(height: 12),
                                ElevatedButton(
                                  onPressed: _refreshData,
                                  child: const Text('Retry'),
                                ),
                              ],
                            ),
                          ),
                        );
                      } else if (!snapshot.hasData || snapshot.data!.isEmpty) {
                        return const Center(
                          child: Text('No community posts yet. Be the first to share!'),
                        );
                      }

                      final posts = snapshot.data!;
                      return ListView.builder(
                        itemCount: posts.length,
                        itemBuilder: (context, index) {
                          final post = posts[index];
                          return Card(
                            margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                            child: Padding(
                              padding: const EdgeInsets.all(12.0),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Row(
                                        children: [
                                          const CircleAvatar(
                                            radius: 14,
                                            child: Icon(Icons.person, size: 16),
                                          ),
                                          const SizedBox(width: 8),
                                          Text(
                                            post.pseudonymId,
                                            style: const TextStyle(
                                              fontWeight: FontWeight.bold,
                                              color: Colors.blueAccent,
                                            ),
                                          ),
                                        ],
                                      ),
                                      Text(
                                        DateTime.fromMillisecondsSinceEpoch(post.createdAt)
                                            .toLocal()
                                            .toString()
                                            .split('.')
                                            .first,
                                        style: const TextStyle(fontSize: 12, color: Colors.grey),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    post.content,
                                    style: const TextStyle(fontSize: 15),
                                  ),
                                  if (post.tags.isNotEmpty) ...[
                                    const SizedBox(height: 8),
                                    Wrap(
                                      spacing: 6,
                                      children: post.tags
                                          .map((tag) => Chip(
                                                label: Text('#$tag',
                                                    style: const TextStyle(fontSize: 11)),
                                                materialTapTargetSize:
                                                    MaterialTapTargetSize.shrinkWrap,
                                                visualDensity: VisualDensity.compact,
                                              ))
                                          .toList(),
                                    ),
                                  ],
                                  const Divider(height: 16),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.end,
                                    children: [
                                      TextButton.icon(
                                        onPressed: () {
                                          _showCommentsDialog(context, post);
                                        },
                                        icon: const Icon(Icons.comment, size: 18),
                                        label: const Text('Comments'),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
          // Sidebar for User Profile & Info (Desktop Responsive View)
          if (MediaQuery.of(context).size.width > 800)
            Expanded(
              flex: 1,
              child: Card(
                margin: const EdgeInsets.all(12),
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: FutureBuilder<UserProfile>(
                    future: _futureProfile,
                    builder: (context, snapshot) {
                      if (snapshot.connectionState == ConnectionState.waiting) {
                        return const Center(child: CircularProgressIndicator());
                      } else if (snapshot.hasError) {
                        return const Text('Profile offline');
                      } else if (!snapshot.hasData) {
                        return const Text('No profile data');
                      }

                      final profile = snapshot.data!;
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'My Pseudonymous Profile',
                            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                          ),
                          const Divider(),
                          const SizedBox(height: 8),
                          Text('Pseudonym:\n${profile.pseudonymId}',
                              style: const TextStyle(fontWeight: FontWeight.w600, color: Colors.blue)),
                          const SizedBox(height: 12),
                          Text('Device UUID:\n${profile.deviceUuid}',
                              style: const TextStyle(fontSize: 11, color: Colors.grey)),
                          const SizedBox(height: 12),
                          Text('Total Posts: ${profile.postsCount}'),
                          const SizedBox(height: 20),
                          const Text(
                            'Privacy Notice:',
                            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                          ),
                          const SizedBox(height: 4),
                          const Text(
                            'Your identity is secured via local Ed25519/ECDSA keys. Zero personal data or emails are stored.',
                            style: TextStyle(fontSize: 11, color: Colors.grey),
                          ),
                        ],
                      );
                    },
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  void _showCommentsDialog(BuildContext context, SocialPost post) {
    showDialog(
      context: context,
      builder: (context) => CommentsDialog(post: post),
    );
  }
}

class CommentsDialog extends StatefulWidget {
  final SocialPost post;
  const CommentsDialog({Key? key, required this.post}) : super(key: key);

  @override
  State<CommentsDialog> createState() => _CommentsDialogState();
}

class _CommentsDialogState extends State<CommentsDialog> {
  late Future<List<SocialComment>> _futureComments;
  final TextEditingController _commentController = TextEditingController();
  bool _isSending = false;

  @override
  void initState() {
    super.initState();
    _loadComments();
  }

  void _loadComments() {
    setState(() {
      _futureComments = SocialService.getComments(widget.post.postId);
    });
  }

  Future<void> _handleSendComment() async {
    final text = _commentController.text.trim();
    if (text.isEmpty) return;

    setState(() {
      _isSending = true;
    });

    try {
      await SocialService.createComment(widget.post.postId, text);
      _commentController.clear();
      _loadComments();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to comment: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isSending = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text('Comments on ${widget.post.pseudonymId}\'s post'),
      content: SizedBox(
        width: 500,
        height: 400,
        child: Column(
          children: [
            Expanded(
              child: FutureBuilder<List<SocialComment>>(
                future: _futureComments,
                builder: (context, snapshot) {
                  if (snapshot.connectionState == ConnectionState.waiting) {
                    return const Center(child: CircularProgressIndicator());
                  } else if (snapshot.hasError) {
                    return Center(child: Text('Error: ${snapshot.error}'));
                  } else if (!snapshot.hasData || snapshot.data!.isEmpty) {
                    return const Center(child: Text('No comments yet. Be the first!'));
                  }

                  final comments = snapshot.data!;
                  return ListView.builder(
                    itemCount: comments.length,
                    itemBuilder: (context, index) {
                      final comment = comments[index];
                      return ListTile(
                        leading: const CircleAvatar(radius: 12, child: Icon(Icons.person, size: 14)),
                        title: Text(comment.pseudonymId,
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                        subtitle: Text(comment.content),
                        trailing: Text(
                          DateTime.fromMillisecondsSinceEpoch(comment.createdAt)
                              .toLocal()
                              .toString()
                              .split('.')
                              .first,
                          style: const TextStyle(fontSize: 10, color: Colors.grey),
                        ),
                      );
                    },
                  );
                },
              ),
            ),
            const Divider(),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _commentController,
                    decoration: const InputDecoration(
                      hintText: 'Write a pseudonymous comment...',
                      isDense: true,
                      border: OutlineInputBorder(),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                ElevatedButton(
                  onPressed: _isSending ? null : _handleSendComment,
                  child: _isSending
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Send'),
                ),
              ],
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Close'),
        ),
      ],
    );
  }
}
