import {
  ACTIONS_CORS_HEADERS,
  ActionGetResponse,
  ActionPostRequest,
  ActionPostResponse,
  createPostResponse,
} from "@solana/actions";

import {
  Connection,
  PublicKey,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createCloseAccountInstruction } from "@solana/spl-token";

const DUST_THRESHOLD = 0.1 * LAMPORTS_PER_SOL; // 0.1 SOL equivalent

const HEADERS = {
  ...ACTIONS_CORS_HEADERS,
  "X-Action-Version": "1",
  "X-Blockchain-Ids": "solana",
  "Content-Type": "application/json",
};

// GET Request - Fetch metadata for the dust cleaning action
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action");

    console.log("GET request received. Action:", action);

    if (!action || action !== "clean_dust") {
      console.error("Invalid or missing action parameter:", action);
      return new Response(JSON.stringify({ error: "Invalid or missing parameters" }), {
        status: 400,
        headers: HEADERS,
      });
    }

    const payload: ActionGetResponse = {
      icon: "https://i.imgur.com/DIb21T3.png",
      title: "Clean Dust from Solana Wallet",
      description: "Convert small token balances (dust) into SOL. Click and connect wallet to clean dust.",
      label: "Clean Dust",
      links: {
        actions: [
          {
            label: "Clean Dust",
            href: `${url.origin}${url.pathname}?action=clean_dust`,
            type: "transaction"
          },
        ],
      },
    };

    console.log("GET request processed successfully. Payload:", payload);
    return new Response(JSON.stringify(payload), {
      headers: HEADERS,
    });
  } catch (error) {
    console.error("Error in GET request:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: HEADERS,
    });
  }
}

// OPTIONS request handler
export async function OPTIONS(request: Request) {
  return new Response(null, {
    headers: HEADERS,
  });
}

// POST Request - Execute the dust cleaning transaction
export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action");

    console.log("POST request received. Action:", action);

    if (!action || action !== "clean_dust") {
      console.error("Invalid action parameter:", action);
      return new Response(JSON.stringify({ error: "Invalid parameters" }), {
        status: 400,
        headers: HEADERS,
      });
    }

    const body: ActionPostRequest = await request.json();

    if (!body.account) {
      console.error("Missing account in request body");
      return new Response(JSON.stringify({ error: "Missing account" }), {
        status: 400,
        headers: HEADERS,
      });
    }

    let account: PublicKey;
    try {
      account = new PublicKey(body.account);
      console.log("User account parsed successfully:", account.toString());
    } catch (error) {
      console.error("Invalid user account provided:", body.account);
      return new Response(JSON.stringify({ error: "Invalid account" }), {
        status: 400,
        headers: HEADERS,
      });
    }

    const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL!, "confirmed");

    // Fetch all token accounts for the user
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(account, { programId: TOKEN_PROGRAM_ID });

    // Filter for dust accounts
    const dustAccounts = tokenAccounts.value.filter((accountInfo) => {
      const balance = accountInfo.account.data.parsed.info.tokenAmount.uiAmount;
      return balance > 0 && balance * LAMPORTS_PER_SOL < DUST_THRESHOLD;
    });

    if (dustAccounts.length === 0) {
      console.log("No dust accounts found for the user.");
      return new Response(JSON.stringify({ error: "No dust accounts found for the user" }), {
        status: 400,
        headers: HEADERS,
      });
    }

    // Create a single transaction to bundle all dust cleaning instructions
    const transaction = new Transaction();
    let totalDustCleaned = 0;

    for (const dustAccount of dustAccounts) {
      const tokenAccountPubkey = dustAccount.pubkey;

      // Add instruction to close the token account and recover SOL
      transaction.add(
        createCloseAccountInstruction(
          tokenAccountPubkey,
          account,
          account,
          []
        )
      );

      totalDustCleaned += dustAccount.account.data.parsed.info.tokenAmount.uiAmount;
    }

    const blockheight = await connection.getLatestBlockhash();
    transaction.feePayer = account;
    transaction.recentBlockhash = blockheight.blockhash;
    transaction.lastValidBlockHeight = blockheight.lastValidBlockHeight;

    const payload: ActionPostResponse = await createPostResponse({
      fields: {
        transaction,
        message: `Dust cleaning transaction created for ${dustAccounts.length} token accounts. Total dust cleaned: ${totalDustCleaned.toFixed(4)} tokens.`,
        type:"transaction"
      },
    });

    console.log("POST request processed successfully. Payload:", payload);

    return new Response(JSON.stringify(payload), {
      headers: HEADERS,
    });
  } catch (error: any) {
    console.error("Error during POST request processing:", error);
    return new Response(JSON.stringify({ error: `Failed to process dust cleaning: ${error.message}` }), {
      status: 500,
      headers: HEADERS,
    });
  }
}