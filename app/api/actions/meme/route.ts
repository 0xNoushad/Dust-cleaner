import {
  ActionPostRequest,
  ActionPostResponse,
  createPostResponse,
} from "@solana/actions";
import axios from 'axios';
import { Transaction } from '@solana/web3.js';
import { NextRequest, NextResponse } from 'next/server';

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

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const COMMON_HEADERS = {
  ...CORS_HEADERS,
  'Cache-Control': 'max-age=3600',
  'X-Action-Version': '1',
  'X-Blockchain-Ids': 'solana-mainnet',
};

export async function GET(): Promise<NextResponse> {
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

    return NextResponse.json(tokenCreationInfo, {
      status: 200,
      headers: COMMON_HEADERS,
    });
  } catch (error) {
    console.error("Error in GET /api/actions/meme:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again later." },
      {
        status: 500,
        headers: COMMON_HEADERS,
      }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: TokenCreationBody;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, {
      status: 400,
      headers: COMMON_HEADERS,
    });
  }

  if (!body.account || !body.name || !body.symbol || !body.description || !body.imageUrl) {
    return NextResponse.json({ error: "Missing required parameters" }, {
      status: 400,
      headers: COMMON_HEADERS,
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

    return NextResponse.json(payload, {
      headers: COMMON_HEADERS,
    });
  } catch (error) {
    console.error("Error creating Blink token:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ error: `Failed to create Blink token: ${errorMessage}` }, {
      status: 500,
      headers: COMMON_HEADERS,
    });
  }
}

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...CORS_HEADERS,
      'Access-Control-Max-Age': '86400',
    },
  });
}