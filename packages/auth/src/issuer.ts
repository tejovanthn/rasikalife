import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { issuer } from '@openauthjs/openauth';
import { GoogleProvider } from '@openauthjs/openauth/provider/google';
import { ArtistClaim, Auth, User } from '@rasika/core';
import { handle } from 'hono/aws-lambda';
// import sharp from 'sharp';
import { Resource } from 'sst';

const s3Client = new S3Client({});

// The fields this flow reads from Google's oauth2/v2/userinfo response. All optional: it is
// someone else's payload, so the guards at the call site decide what is required, not this type.
interface GoogleUserInfo {
  email?: string;
  verified_email?: boolean;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  id?: string;
}

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
      if (!response.ok) {
        throw new Error(`Google userinfo request failed with status ${response.status}`);
      }
      // `response.json()` is typed `unknown`, so every field read below was an unchecked cast.
      // Naming the shape once means the guards that follow are actually type-checked.
      const userInfo = (await response.json()) as GoogleUserInfo;

      const { email, name, id: sub, picture: googlePicture } = userInfo;

      // The email is about to become an authorization key, not just a contact field: phase 8
      // grants an artist profile to whoever signs in with the address a moderator recorded
      // during enrichment (plan §4.3.1). An address Google has not verified would let anyone
      // holding an unverified account claim someone else's profile, so refuse the login
      // outright — that way every stored user has a verified address by construction and the
      // claim lookup never has to re-check. The v2 userinfo endpoint spells it `verified_email`;
      // the OIDC endpoint spells it `email_verified`. Accept either, require one.
      const emailVerified = userInfo.verified_email ?? userInfo.email_verified;
      if (!email || emailVerified !== true) {
        throw new Error('Google account has no verified email address');
      }
      // Without the subject there is no stable identity to key the user on; without a name
      // there is nothing to display. Both are always present in practice — this is a guard
      // against a malformed response, not an expected branch.
      if (!sub || !name) {
        throw new Error('Google userinfo response is missing the subject or name');
      }

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

      // If a moderator recorded this address against an artist during enrichment, the profile
      // becomes theirs now (plan §4.3.1). This is the whole point of the invited-claim path:
      // the artist signs in with the address the moderator was already emailing and the
      // profile is simply there, with no claim form and no queue.
      //
      // Safe on every login — no invite means one query and no writes. Deliberately not fatal:
      // a failure here must not lock someone out of the site over a profile grant they can
      // pick up on their next sign-in, since redemption is idempotent.
      try {
        const granted = await ArtistClaim.redeemArtistClaimInvites({
          userId: user.id,
          userName: user.name,
          email,
        });
        if (granted.length > 0) {
          console.log(
            `[auth] redeemed ${granted.length} artist invite(s) for ${user.id}:`,
            granted.map(a => a.artistId).join(', ')
          );
        }
      } catch (err) {
        console.error('[auth] failed to redeem artist claim invites:', err);
      }

      return ctx.subject('user', {
        userID: user.id,
      });
    }

    throw new Error('Unsupported provider');
  },
});

export const handler = handle(app);
