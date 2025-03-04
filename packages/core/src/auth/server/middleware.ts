import 'isomorphic-fetch';
import { IncomingMessage, ServerResponse } from 'http';
import { getQueryParam, log } from '../../utils';
import { Cookies } from './cookie';
import { OAuth } from './token';

export function redirect(res: ServerResponse, url: string): void {
  res.writeHead(302, {
    Location: url,
  });

  res.end();
}

export interface AuthorizeResponse {
  accessToken: string;
  accessTokenExpiration: number;
  refreshToken: string;
  refreshTokenExpiration: number;
}

/**
 * A Node handler for processing incoming requests to exchange an Authorization Code
 * for an Access Token using the WordPress API. Once the code is exchanged, this
 * handler stores the Access Token on the cookie and redirects to the frontend.
 */
export async function authorizeHandler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const url = req.url as string;
  const code = getQueryParam(url, 'code');
  const oauth = new OAuth(new Cookies(req, res));
  const refreshToken = oauth.getRefreshToken();

  if (!refreshToken && !code) {
    res.statusCode = 401;
    res.end(JSON.stringify({ error: 'Unauthorized' }));

    return;
  }

  try {
    const result = await oauth.fetch(code);

    if (oauth.isOAuthTokens(result)) {
      oauth.setRefreshToken(result.refreshToken);
      res.statusCode = 200;
      res.end(JSON.stringify(result));
    } else {
      const {
        response: { status },
      } = result;

      if (status > 299) {
        res.statusCode = result.response.status;
      } else {
        res.statusCode = 401;
      }

      res.end(JSON.stringify(result.result));
    }
  } catch (e) {
    log(e);

    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Internal Server Error' }));
  }
}
