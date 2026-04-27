/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/space_vault_program.json`.
 */
export type SpaceVaultProgram = {
  "address": "4bRZK8XfziVhLCgvtRdFJyTgN6tXGSPJT8xfbtt1AxBB",
  "metadata": {
    "name": "spaceVaultProgram",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "claim",
      "discriminator": [
        62,
        198,
        214,
        193,
        213,
        159,
        108,
        210
      ],
      "accounts": [
        {
          "name": "player",
          "writable": true,
          "signer": true
        },
        {
          "name": "vaultConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "mint",
          "relations": [
            "depositPool"
          ]
        },
        {
          "name": "depositPool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  112,
                  111,
                  115,
                  105,
                  116,
                  45,
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "deposit_pool.depositor",
                "account": "depositPool"
              },
              {
                "kind": "account",
                "path": "deposit_pool.mint",
                "account": "depositPool"
              }
            ]
          }
        },
        {
          "name": "claimRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  108,
                  97,
                  105,
                  109,
                  45,
                  114,
                  101,
                  99,
                  111,
                  114,
                  100
                ]
              },
              {
                "kind": "arg",
                "path": "claimId"
              }
            ]
          }
        },
        {
          "name": "vaultAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "depositPool"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "playerTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "player"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "instructionsSysvar",
          "address": "Sysvar1nstructions1111111111111111111111111"
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "claimId",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "expiry",
          "type": "i64"
        }
      ]
    },
    {
      "name": "crankLiquidity",
      "discriminator": [
        1,
        222,
        14,
        191,
        61,
        205,
        81,
        198
      ],
      "accounts": [
        {
          "name": "cranker",
          "writable": true,
          "signer": true
        },
        {
          "name": "vaultConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "buybackVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  121,
                  98,
                  97,
                  99,
                  107,
                  45,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "meteoraPool",
          "writable": true
        },
        {
          "name": "positionNftMint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  101,
                  116,
                  101,
                  111,
                  114,
                  97,
                  45,
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110,
                  45,
                  109,
                  105,
                  110,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "position",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "positionNftMint"
              }
            ],
            "program": {
              "kind": "account",
              "path": "meteoraProgram"
            }
          }
        },
        {
          "name": "positionNftAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110,
                  95,
                  110,
                  102,
                  116,
                  95,
                  97,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "positionNftMint"
              }
            ],
            "program": {
              "kind": "account",
              "path": "meteoraProgram"
            }
          }
        },
        {
          "name": "tokenAMint"
        },
        {
          "name": "tokenBMint"
        },
        {
          "name": "vaultConfigTokenAAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vaultConfig"
              },
              {
                "kind": "account",
                "path": "tokenAProgram"
              },
              {
                "kind": "account",
                "path": "tokenAMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "vaultConfigTokenBAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vaultConfig"
              },
              {
                "kind": "account",
                "path": "tokenBProgram"
              },
              {
                "kind": "account",
                "path": "tokenBMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenAVault",
          "writable": true
        },
        {
          "name": "tokenBVault",
          "writable": true
        },
        {
          "name": "poolAuthority",
          "address": "HLnpSz9h2S4hiLQ43rnSD9XkcUThA7B8hQMKmDaiTLcC"
        },
        {
          "name": "eventAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  95,
                  95,
                  101,
                  118,
                  101,
                  110,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ],
            "program": {
              "kind": "account",
              "path": "meteoraProgram"
            }
          }
        },
        {
          "name": "meteoraProgram",
          "address": "cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG"
        },
        {
          "name": "positionTokenProgram"
        },
        {
          "name": "tokenAProgram"
        },
        {
          "name": "tokenBProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "deposit",
      "discriminator": [
        242,
        35,
        198,
        137,
        82,
        225,
        242,
        182
      ],
      "accounts": [
        {
          "name": "depositor",
          "writable": true,
          "signer": true,
          "relations": [
            "depositPool"
          ]
        },
        {
          "name": "mint",
          "relations": [
            "depositPool"
          ]
        },
        {
          "name": "depositPool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  112,
                  111,
                  115,
                  105,
                  116,
                  45,
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "deposit_pool.depositor",
                "account": "depositPool"
              },
              {
                "kind": "account",
                "path": "deposit_pool.mint",
                "account": "depositPool"
              }
            ]
          }
        },
        {
          "name": "depositorTokenAccount",
          "writable": true
        },
        {
          "name": "vaultAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "depositPool"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "gamePayment",
      "discriminator": [
        44,
        5,
        226,
        247,
        176,
        177,
        31,
        183
      ],
      "accounts": [
        {
          "name": "player",
          "writable": true,
          "signer": true
        },
        {
          "name": "vaultConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "operationalWallet",
          "writable": true
        },
        {
          "name": "operatorWallet",
          "writable": true
        },
        {
          "name": "buybackVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  121,
                  98,
                  97,
                  99,
                  107,
                  45,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initialize",
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "vaultConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "paymentWeights",
          "type": {
            "defined": {
              "name": "paymentWeights"
            }
          }
        },
        {
          "name": "buybackRate",
          "type": "u64"
        },
        {
          "name": "convexAuthority",
          "type": "pubkey"
        },
        {
          "name": "operationalWallet",
          "type": "pubkey"
        },
        {
          "name": "operatorWallet",
          "type": "pubkey"
        },
        {
          "name": "buybackWallet",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "registerPool",
      "discriminator": [
        85,
        229,
        114,
        47,
        75,
        145,
        166,
        100
      ],
      "accounts": [
        {
          "name": "depositor",
          "writable": true,
          "signer": true
        },
        {
          "name": "mint"
        },
        {
          "name": "depositPool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  112,
                  111,
                  115,
                  105,
                  116,
                  45,
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "depositor"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "vaultAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "depositPool"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "setMeteoraPool",
      "discriminator": [
        98,
        249,
        21,
        7,
        173,
        94,
        135,
        74
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "vaultConfig"
          ]
        },
        {
          "name": "vaultConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "meteoraPool",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "setWeights",
      "discriminator": [
        25,
        58,
        193,
        19,
        186,
        84,
        236,
        187
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "vaultConfig"
          ]
        },
        {
          "name": "vaultConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "paymentWeights",
          "type": {
            "defined": {
              "name": "paymentWeights"
            }
          }
        },
        {
          "name": "buybackRate",
          "type": "u64"
        },
        {
          "name": "convexAuthority",
          "type": "pubkey"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "claimRecord",
      "discriminator": [
        57,
        229,
        0,
        9,
        65,
        62,
        96,
        7
      ]
    },
    {
      "name": "depositPool",
      "discriminator": [
        64,
        107,
        122,
        248,
        155,
        187,
        255,
        28
      ]
    },
    {
      "name": "vaultConfig",
      "discriminator": [
        99,
        86,
        43,
        216,
        184,
        102,
        119,
        77
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidWeights",
      "msg": "Payment weights must sum to 10000 basis points."
    },
    {
      "code": 6001,
      "name": "invalidAmount",
      "msg": "Amount must be greater than zero."
    },
    {
      "code": 6002,
      "name": "mathOverflow",
      "msg": "Arithmetic overflow."
    },
    {
      "code": 6003,
      "name": "poolInactive",
      "msg": "Deposit pool is inactive."
    },
    {
      "code": 6004,
      "name": "claimExpired",
      "msg": "Claim has expired."
    },
    {
      "code": 6005,
      "name": "missingEd25519Instruction",
      "msg": "Missing ed25519 verification instruction."
    },
    {
      "code": 6006,
      "name": "invalidEd25519Instruction",
      "msg": "Invalid ed25519 verification instruction."
    },
    {
      "code": 6007,
      "name": "invalidConvexAuthority",
      "msg": "Invalid Convex authority."
    },
    {
      "code": 6008,
      "name": "invalidClaimMessage",
      "msg": "Claim message does not match the signed payload."
    },
    {
      "code": 6009,
      "name": "insufficientPoolBalance",
      "msg": "Pool balance is insufficient for this claim."
    },
    {
      "code": 6010,
      "name": "invalidTokenAccountOwner",
      "msg": "Token account owner does not match the expected signer."
    },
    {
      "code": 6011,
      "name": "invalidMint",
      "msg": "Token mint does not match the pool mint."
    },
    {
      "code": 6012,
      "name": "invalidMeteoraProgram",
      "msg": "Invalid Meteora DAMM v2 program account."
    },
    {
      "code": 6013,
      "name": "invalidMeteoraPool",
      "msg": "Failed to deserialize the configured Meteora pool."
    },
    {
      "code": 6014,
      "name": "invalidMeteoraMint",
      "msg": "Meteora mint accounts do not match the configured pool."
    },
    {
      "code": 6015,
      "name": "invalidMeteoraVault",
      "msg": "Meteora vault accounts do not match the configured pool."
    },
    {
      "code": 6016,
      "name": "invalidMeteoraPoolAuthority",
      "msg": "Configured Meteora pool authority is invalid."
    },
    {
      "code": 6017,
      "name": "invalidWrappedSolMint",
      "msg": "Configured Meteora pool must use wrapped SOL as token B."
    },
    {
      "code": 6018,
      "name": "insufficientBuybackBalance",
      "msg": "Insufficient accumulated buyback SOL in the vault config PDA."
    },
    {
      "code": 6019,
      "name": "invalidLiquidityQuote",
      "msg": "Unable to derive a valid Meteora liquidity quote from the pool state."
    }
  ],
  "types": [
    {
      "name": "claimRecord",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "claimId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "claimedAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "depositPool",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "depositor",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "totalDeposited",
            "type": "u64"
          },
          {
            "name": "remaining",
            "type": "u64"
          },
          {
            "name": "active",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "paymentWeights",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "operationalBps",
            "type": "u16"
          },
          {
            "name": "operatorBps",
            "type": "u16"
          },
          {
            "name": "buybackBps",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "vaultConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "paymentWeights",
            "type": {
              "defined": {
                "name": "paymentWeights"
              }
            }
          },
          {
            "name": "reserved",
            "type": "u64"
          },
          {
            "name": "convexAuthority",
            "type": "pubkey"
          },
          {
            "name": "operationalWallet",
            "type": "pubkey"
          },
          {
            "name": "operatorWallet",
            "type": "pubkey"
          },
          {
            "name": "meteoraPool",
            "type": "pubkey"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ]
};
