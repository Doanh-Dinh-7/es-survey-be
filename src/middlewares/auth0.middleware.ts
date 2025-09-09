import { Request, Response, NextFunction } from 'express';
import { auth } from 'express-oauth2-jwt-bearer';
import { PrismaClient } from '@prisma/client';
import { UnauthorizedException } from '../exceptions/http.exception';
import axios from 'axios';

const prisma = new PrismaClient();


// Validate Auth0 JWT tokens
export const auth0Middleware = auth({
  audience: process.env.AUDIENCE,
  issuerBaseURL: `https://${process.env.ISSUER_BASE_URL}`,
  tokenSigningAlg: 'RS256'
});

async function getManagementToken() {
  const res = await axios.post(`https://${process.env.ISSUER_BASE_URL}/oauth/token`, {
    client_id: process.env.AUTH0_M2M_CLIENT_ID,
    client_secret: process.env.AUTH0_M2M_CLIENT_SECRET,
    audience: `https://${process.env.ISSUER_BASE_URL}/api/v2/`,
    grant_type: 'client_credentials',
  });
  return res.data.access_token;
}

export const userMapperMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const auth0Id = req.auth?.payload.sub;
    const orgId = req.auth?.payload.org_id as string;
    const email = req.auth?.payload['https://seniorintern.dev/email'] as string;
    const userIdFromClaim = req.auth?.payload['https://seniorintern.dev/user_id'] as string;

    if (!auth0Id || !email || !orgId) {
      throw new UnauthorizedException("Missing required fields in token");
    }

    // Always identify user by email
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        auth0Id, // can update this to reflect the latest login method
        orgId,
      },
      create: {
        email,
        auth0Id,
        orgId,
      },
    });

    // Update user's app_metadata with user ID and add it to the token claims if not present
    // if (!userIdFromClaim || userIdFromClaim !== user.id) {
    //   const mgmtToken = await getManagementToken();
    //   // Update app_metadata
    //   await axios.patch(
    //     `https://${process.env.ISSUER_BASE_URL}/api/v2/users/${auth0Id}`,
    //     { 
    //       app_metadata: { user_id: user.id },
    //       user_metadata: { user_id: user.id },
    //     },
    //     { headers: { Authorization: `Bearer ${mgmtToken}` } }
    //   );
      
    //   // Add the user ID to the token claims
    //   await axios.post(
    //     `https://${process.env.ISSUER_BASE_URL}/api/v2/users/${auth0Id}/custom_claims`,
    //     { 
    //       "https://seniorintern.dev/user_id": user.id 
    //     },
    //     { 
    //       headers: { 
    //         Authorization: `Bearer ${mgmtToken}`,
    //         'Content-Type': 'application/json'
    //       }
    //     }
    //   );
    // }

    req.user = user;
    next();
  } catch (error) {
    console.error("userMapperMiddleware error:", error);
    next(error);
  }
};
