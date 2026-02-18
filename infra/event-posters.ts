export const eventPostersBucket = new sst.aws.Bucket('EventPosters', {
  public: true,
});

export const geminiApiKey = new sst.Secret('GeminiApiKey');
