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
    links: {
      submit: {
        label: string;
        href: string;
      };
    };
  }
  
  interface TokenCreationBody extends ActionPostRequest {
    name: string;
    symbol: string;
    description: string;
    imageUrl: string;
  }
  
  export async function GET(request: Request): Promise<Response> {
    const payload: CustomActionGetResponse = {
      title: "Create Your Token",
      description: "Fill in the details to create your own token on Solana.",
      inputs: [
        { label: "Name", name: "name", type: "text", required: true },
        { label: "Symbol", name: "symbol", type: "text", required: true },
        { label: "Description", name: "description", type: "textarea", required: true },
        { label: "Image URL", name: "imageUrl", type: "url", required: true }
      ],
      links: {
        submit: {
          label: "Create Token",
          href: `${new URL(request.url).origin}/api/create-token`,
        },
      },
      icon: "",
      label: ""
    };
  
    return Response.json(payload, {
      headers: ACTIONS_CORS_HEADERS,
    });
  }
  
  export const OPTIONS = GET;
  
  export async function POST(request: Request): Promise<Response> {
    let body: TokenCreationBody;
  
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid request body" }, {
        status: 400,
        headers: ACTIONS_CORS_HEADERS,
      });
    }
  
    if (!body.account || !body.name || !body.symbol || !body.description || !body.imageUrl) {
      return Response.json({ error: "Missing required parameters" }, {
        status: 400,
        headers: ACTIONS_CORS_HEADERS,
      });
    }
  
    let account: PublicKey;
    try {
      account = new PublicKey(body.account);
    } catch {
      return Response.json({ error: "Invalid account" }, {
        status: 400,
        headers: ACTIONS_CORS_HEADERS,
      });
    }
  
    const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL || "", "confirmed");
  
    try {
      const mintKeypair = Keypair.generate();
      const mintRent = await connection.getMinimumBalanceForRentExemption(MintLayout.span);
  
      const transaction = new Transaction().add(
        SystemProgram.createAccount({
          fromPubkey: account,
          newAccountPubkey: mintKeypair.publicKey,
          space: MintLayout.span,
          lamports: mintRent,
          programId: TOKEN_PROGRAM_ID,
        }),
        createInitializeMintInstruction(
          mintKeypair.publicKey,
          9, // 9 decimals
          account,
          account,
          TOKEN_PROGRAM_ID
        )
      );
  
      const associatedTokenAddress = await getAssociatedTokenAddress(
        mintKeypair.publicKey,
        account,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
  
      transaction.add(
        createAssociatedTokenAccountInstruction(
          account,
          associatedTokenAddress,
          account,
          mintKeypair.publicKey,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        ),
        createMintToInstruction(
          mintKeypair.publicKey,
          associatedTokenAddress,
          account,
          BigInt(1_000_000 * (10 ** 9)), // 1 million tokens
          [],
          TOKEN_PROGRAM_ID
        )
      );
  
      const blockheight = await connection.getLatestBlockhash();
      transaction.feePayer = account;
      transaction.recentBlockhash = blockheight.blockhash;
      transaction.lastValidBlockHeight = blockheight.lastValidBlockHeight;
  
      const payload: ActionPostResponse = await createPostResponse({
        fields: {
          transaction,
          message: `Token "${body.name}" (${body.symbol}) creation transaction prepared. Mint address: ${mintKeypair.publicKey.toString()}`,
          type: "transaction",
        },
      });
  
      return Response.json(payload, {
        headers: ACTIONS_CORS_HEADERS,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      return Response.json({ error: `Failed to create token: ${errorMessage}` }, {
        status: 500,
        headers: ACTIONS_CORS_HEADERS,
      });
    }
  }