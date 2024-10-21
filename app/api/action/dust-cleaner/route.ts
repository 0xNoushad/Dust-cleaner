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

const DUST_THRESHOLD = 0.1 * LAMPORTS_PER_SOL;  
 
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action");

    console.log("GET request received. Action:", action);

    if (!action || action !== "clean_dust") {
      console.error("Invalid or missing action parameter:", action);
      return new Response(JSON.stringify({ error: "Invalid or missing parameters" }), {
        status: 400,
        headers: ACTIONS_CORS_HEADERS,
      });
    }

    const payload: ActionGetResponse = {
      icon: "https://s3.ezgif.com/tmp/ezgif-3-275bc52dc3.jpg",
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
      headers: ACTIONS_CORS_HEADERS,
    });
  } catch (error) {
    console.error("Error in GET request:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: ACTIONS_CORS_HEADERS,
    });
  }
}

export const OPTIONS = GET;

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
        headers: ACTIONS_CORS_HEADERS,
      });
    }

    const body: ActionPostRequest = await request.json();

    let account: PublicKey;
    try {
      account = new PublicKey(body.account);
      console.log("User account parsed successfully:", account.toString());
    } catch (error) {
      console.error("Invalid user account provided:", body.account);
      return new Response(JSON.stringify({ error: "Invalid account" }), {
        status: 400,
        headers: ACTIONS_CORS_HEADERS,
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
        headers: ACTIONS_CORS_HEADERS,
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
        type: "transaction"
      },
    });

    console.log("POST request processed successfully. Payload:", payload);

    return new Response(JSON.stringify(payload), {
      headers: ACTIONS_CORS_HEADERS,
    });
  } catch (error: any) {
    console.error("Error during POST request processing:", error);
    return new Response(JSON.stringify({ error: `Failed to process dust cleaning: ${error.message}` }), {
      status: 500,
      headers: ACTIONS_CORS_HEADERS,
    });
  }
}