import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { issuer } from '@openauthjs/openauth';
import { GoogleProvider } from '@openauthjs/openauth/provider/google';
import { Auth, User } from '@rasika/core';
import { handle } from 'hono/aws-lambda';
// import sharp from 'sharp';
import { Resource } from 'sst';

const s3Client = new S3Client({});

/**
 * Downloads a profile photo from Google and uploads it to S3.
 * Returns the S3 URL on success, or undefined on failure.
 */
async function uploadProfilePhoto(
  googlePhotoUrl: string,
  userId: string
): Promise<string | undefined> {
  try {
    // Download from Google
    const response = await fetch(googlePhotoUrl);
    if (!response.ok) {
      console.error('[issuer] Failed to download profile photo:', response.status);
      return undefined;
    }

    const buffer = await response.arrayBuffer();

    // // Convert to WebP (256x256 cover crop)
    // const webpBuffer = await sharp(Buffer.from(buffer))
    //   .resize(256, 256, { fit: 'cover' })
    //   .webp({ quality: 80 })
    //   .toBuffer();

    // Upload to S3
    const key = `profile-photos/${userId}.webp`;
    await s3Client.send(
      new PutObjectCommand({
        Bucket: Resource.RasikaBucket.name,
        Key: key,
        // Body: webpBuffer,
        Body: Buffer.from(buffer), // Upload original image without conversion for now  
        ContentType: 'image/webp',
      })
    );

    // Return public URL
    return `https://${Resource.RasikaBucket.name}.s3.amazonaws.com/${key}`;
  } catch (error) {
    console.error('[issuer] Failed to upload profile photo:', error);
    return undefined;
  }
}

const app = issuer({
  // Allow localhost redirects during development
  allow: async input => {
    const url = new URL(input.redirectURI);
    // Allow localhost for dev and the production domain
    if (
      url.hostname === 'localhost' ||
      url.hostname.endsWith('.rasika.life') ||
      url.hostname === 'rasika.life'
    ) {
      return true;
    }
    return false;
  },
  providers: {
    google: GoogleProvider({
      clientID: Resource.GoogleClientId.value,
      clientSecret: Resource.GoogleClientSecret.value,
      scopes: ['openid', 'email', 'profile'],
    }),
  },
  // Add error handler to log OAuth errors
  error(ctx, error) {
    console.error('[issuer] OAuth error:', {
      error: error.error,
      description: error.description,
      url: ctx.req.url,
      headers: Object.fromEntries(ctx.req.raw.headers.entries()),
    });
    // Continue with default error handling
    return ctx.error(error.error, error.description);
  },
  subjects: Auth.subjects,
  async success(ctx, value) {
    if (value.provider === 'google') {
      const tokenset = value.tokenset;

      // Fetch user info using the access token
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${tokenset.access}`,
        },
      });
      const userInfo = await response.json();

      const email = userInfo.email as string;
      const name = userInfo.name as string;
      const googlePicture = userInfo.picture as string | undefined;
      const sub = userInfo.id as string;

      const user = await User.findOrCreateUser({
        email,
        name,
        googleId: sub,
      });

      // Upload profile photo to S3 if available (using user's KSUID, not Google's ID)
      if (googlePicture && !user.picture) {
        const picture = await uploadProfilePhoto(googlePicture, user.id);
        if (picture) {
          await User.updateUser(user.id, { picture });
        }
      }

      return ctx.subject('user', {
        userID: user.id,
      });
    }

    throw new Error('Unsupported provider');
  },
});

export const handler = handle(app);
