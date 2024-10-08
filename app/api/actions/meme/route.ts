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
    SystemProgram,
    Keypair,
  } from "@solana/web3.js";
  
  import {
    createInitializeMintInstruction,
    createAssociatedTokenAccountInstruction,
    createMintToInstruction,
    getAssociatedTokenAddress,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    MintLayout,
  } from "@solana/spl-token";
  
  interface CustomActionGetResponse extends Omit<ActionGetResponse, 'links'> {
    inputs: Array<{
      label: string;
      name: string;
      type: string;
      required: boolean;
    }>;
    links: ActionGetResponse['links'] & {
      submit: {
        label: string;
        href: string;
      };
    };
  }
  
  export async function GET(request: Request) {
    console.log("GET request received for meme coin creation form");
  
    const payload: CustomActionGetResponse = {
      icon: "https://example.com/meme-coin-icon.png",
      title: "Create Your Meme Coin",
      description: "Fill in the details to create your own meme coin on Solana.",
      label: "Create Meme Coin",
      inputs: [
        { label: "Name", name: "name", type: "text", required: true },
        { label: "Symbol", name: "symbol", type: "text", required: true },
        { label: "Description", name: "description", type: "textarea", required: true },
        { label: "Image URL", name: "imageUrl", type: "url", required: true }
      ],
      links: {
        actions: [
          {
            label: "Create Meme Coin",
            href: `${new URL(request.url).origin}/api/create-meme-coin`,
            type: "transaction",
          },
        ],
        submit: {
          label: "Create Meme Coin",
          href: `${new URL(request.url).origin}/api/create-meme-coin`,
        },
      },
    };
  
    console.log("GET request processed successfully. Full Payload:", JSON.stringify(payload, null, 2));
    return Response.json(payload, {
      headers: ACTIONS_CORS_HEADERS,
    });
  }
  
  export const OPTIONS = GET;
  
  export async function POST(request: Request) {
    console.log("POST request received for meme coin creation");
  
    let body: ActionPostRequest & {
      name: string;
      symbol: string;
      description: string;
      imageUrl: string;
    };
  
    try {
      body = await request.json();
    } catch (error) {
      console.error("Error parsing request body:", error);
      return Response.json({ error: "Invalid request body" }, {
        status: 400,
        headers: ACTIONS_CORS_HEADERS,
      });
    }
  
    if (!body.account || !body.name || !body.symbol || !body.description || !body.imageUrl) {
      console.error("Missing required parameters");
      return Response.json({ error: "Missing required parameters" }, {
        status: 400,
        headers: ACTIONS_CORS_HEADERS,
      });
    }
  
    let account: PublicKey;
    try {
      account = new PublicKey(body.account);
      console.log("User account parsed successfully:", account.toString());
    } catch (error) {
      console.error("Invalid user account provided:", body.account);
      return Response.json({ error: "Invalid account" }, {
        status: 400,
        headers: ACTIONS_CORS_HEADERS,
      });
    }
  
    if (!process.env.NEXT_PUBLIC_RPC_URL) {
      console.error("RPC URL not configured");
      return Response.json({ error: "Server configuration error" }, {
        status: 500,
        headers: ACTIONS_CORS_HEADERS,
      });
    }
  
    const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL, "confirmed");
  
    try {
      // Generate a new mint address
      const mintKeypair = Keypair.generate();
  
      // Calculate the rent-exempt balance
      const mintRent = await connection.getMinimumBalanceForRentExemption(MintLayout.span);
  
      // Create mint account
      const createMintAccountIx = SystemProgram.createAccount({
        fromPubkey: account,
        newAccountPubkey: mintKeypair.publicKey,
        space: MintLayout.span,
        lamports: mintRent,
        programId: TOKEN_PROGRAM_ID,
      });
  
      // Initialize mint instruction
      const initializeMintIx = createInitializeMintInstruction(
        mintKeypair.publicKey,
        9, // Standard 9 decimals for meme coins
        account,
        account,
        TOKEN_PROGRAM_ID
      );
  
      // Get associated token account address
      const associatedTokenAddress = await getAssociatedTokenAddress(
        mintKeypair.publicKey,
        account,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
  
      // Create associated token account instruction
      const createAssociatedTokenAccountIx = createAssociatedTokenAccountInstruction(
        account,
        associatedTokenAddress,
        account,
        mintKeypair.publicKey,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
  
      // Mint to instruction (1 million tokens as initial supply)
      const mintToIx = createMintToInstruction(
        mintKeypair.publicKey,
        associatedTokenAddress,
        account,
        BigInt(1_000_000 * (10 ** 9)),
        [],
        TOKEN_PROGRAM_ID
      );
  
      // Combine all instructions into a single transaction
      const transaction = new Transaction().add(
        createMintAccountIx,
        initializeMintIx,
        createAssociatedTokenAccountIx,
        mintToIx
      );
  
      const blockheight = await connection.getLatestBlockhash();
      transaction.feePayer = account;
      transaction.recentBlockhash = blockheight.blockhash;
      transaction.lastValidBlockHeight = blockheight.lastValidBlockHeight;
  
      const payload: ActionPostResponse = await createPostResponse({
        fields: {
          transaction,
          message: `Meme coin "${body.name}" (${body.symbol}) creation transaction prepared. Mint address: ${mintKeypair.publicKey.toString()}`,
          type: "transaction",
        },
      });
  
      console.log("POST request processed successfully. Payload:", payload);
  
      return Response.json(payload, {
        headers: ACTIONS_CORS_HEADERS,
      });
    } catch (error: any) {
      console.error("Error during POST request processing:", error);
      return Response.json({ error: `Failed to create meme coin: ${error.message}` }, {
        status: 500,
        headers: ACTIONS_CORS_HEADERS,
      });
    }
  }