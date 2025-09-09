import { Socket } from 'socket.io';
import jwt, { JwtHeader } from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';

const jwksClient = jwksRsa({
  jwksUri: `https://${process.env.AUTH0_ISSUER_BASE_URL}/.well-known/jwks.json`, // e.g. https://dev-abc123.us.auth0.com/.well-known/jwks.json
});

function getKey(header: JwtHeader, callback: jwt.SigningKeyCallback) {
  jwksClient.getSigningKey(header.kid!, (err, key) => {
    if (err || !key) return callback(err, undefined);
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

export const socketAuth = (socket: Socket, next: (err?: Error) => void) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication token missing'));

  jwt.verify(
    token,
    getKey,
    {
      algorithms: ['RS256'],
      audience: process.env.AUTH0_AUDIENCE,
      issuer: `${process.env.AUTH0_ISSUER_BASE_URL}/`,
    },
    (err, decoded) => {
      if (err) return next(new Error('Invalid token'));
      socket.data.user = decoded;
      next();
    }
  );
};
