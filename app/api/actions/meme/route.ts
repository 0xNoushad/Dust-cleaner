import {
  ACTIONS_CORS_HEADERS,
  ActionPostRequest,
  ActionPostResponse,
  createPostResponse,
} from "@solana/actions";
import axios from 'axios';
import { Transaction } from '@solana/web3.js';

interface TokenCreationBody extends ActionPostRequest {
  name: string;
  symbol: string;
  description: string;
  imageUrl: string;
}

interface TokenCreationResponse {
  title: string;
  description: string;
  inputs: Array<{
    label: string;
    name: string;
    type: string;
    required: boolean;
  }>;
  links: {
    submit: {
      label: string;
      href: string;
    };
  };
  icon: string;
  label: string;
}

const PUMP_API_URL = 'https://api.pump.fun/create-token';

const HEADERS = {
  ...ACTIONS_CORS_HEADERS,
  'Cache-Control': 'max-age=3600',
  'X-Action-Version': '1',
  'X-Blockchain-Ids': 'solana-mainnet',
};

export async function GET(): Promise<Response> {
  try {
    const tokenCreationInfo = {
      title: "Create Your Blink Token",
      description: "Use this endpoint to create a new Blink token on the Solana blockchain.",
      version: "1.0.0",
      endpoints: {
        get: {
          description: "Retrieve information about the token creation process",
          url: "/api/actions/meme",
          method: "GET",
        },
        post: {
          description: "Submit a request to create a new Blink token",
          url: "/api/actions/meme",
          method: "POST",
          bodyParameters: [
            { name: "account", type: "string", description: "The Solana account address that will own the token", required: true },
            { name: "name", type: "string", description: "The name of your Blink token", required: true },
            { name: "symbol", type: "string", description: "The symbol of your Blink token (e.g., BLK)", required: true },
            { name: "description", type: "string", description: "A brief description of your Blink token", required: true },
            { name: "imageUrl", type: "string", description: "A URL pointing to the image for your Blink token", required: true },
          ],
        },
      },
      additionalInfo: {
        fees: "Creating a Blink token may incur blockchain fees. Please ensure your account has sufficient SOL to cover these fees.",
        support: "For support, please contact support@blink.com",
      },
    };

    return Response.json(tokenCreationInfo, {
      status: 200,
      headers: HEADERS,
    });
  } catch (error) {
    console.error("Error in GET /api/actions/meme:", error);
    return Response.json(
      { error: "An unexpected error occurred. Please try again later." },
      {
        status: 500,
        headers: HEADERS,
      }
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  let body: TokenCreationBody;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, {
      status: 400,
      headers: HEADERS,
    });
  }

  if (!body.account || !body.name || !body.symbol || !body.description || !body.imageUrl) {
    return Response.json({ error: "Missing required parameters" }, {
      status: 400,
      headers: HEADERS,
    });
  }

  try {
    const response = await axios.post<TokenCreationResponse>(PUMP_API_URL, {
      owner: body.account,
      name: body.name,
      symbol: body.symbol,
      description: body.description,
      imageUrl: body.imageUrl,
    });

    // Create a dummy transaction since we don't have an actual one from the API
    const dummyTransaction = new Transaction();

    const payload: ActionPostResponse = await createPostResponse({
      fields: {
        transaction: dummyTransaction,
        message: `Blink token creation request for "${body.name}" (${body.symbol}) prepared. Please review the form data: ${JSON.stringify(response.data)}`,
        type: "transaction",
      },
    });

    return Response.json(payload, {
      headers: HEADERS,
    });
  } catch (error) {
    console.error("Error creating Blink token:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return Response.json({ error: `Failed to create Blink token: ${errorMessage}` }, {
      status: 500,
      headers: HEADERS,
    });
  }
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      ...HEADERS,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}