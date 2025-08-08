;; DisputeResolver.clar
;; Clarity v2
;; Manages dispute resolution with stake-based or DAO-based arbitration

;; Constants
(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-DISPUTE u101)
(define-constant ERR-NOT-FOUND u102)
(define-constant ERR-ALREADY-VOTED u103)
(define-constant ERR-VOTING-CLOSED u104)
(define-constant ERR-ZERO-ADDRESS u105)
(define-constant ERR-INVALID-AMOUNT u106)
(define-constant ERR-INVALID-STATUS u107)
(define-constant ERR-INSUFFICIENT-STAKE u108)
(define-constant ERR-VOTING-NOT-STARTED u109)

;; Status enum
(define-constant STATUS-INITIATED u0)
(define-constant STATUS-VOTING u1)
(define-constant STATUS-RESOLVED u2)
(define-constant STATUS-CANCELLED u3)

;; Data structures
(define-data-var admin principal tx-sender)
(define-data-var rental-agreement principal 'SP000000000000000000002Q6VF78) ;; Placeholder for RentalAgreement contract
(define-data-var escrow-vault principal 'SP000000000000000000002Q6VF78) ;; Placeholder for EscrowVault contract
(define-data-var min-stake uint u1000) ;; Minimum stake in microSTX for arbitrators
(define-data-var voting-period uint u1440) ;; ~10 days at 10min/block

(define-map disputes
  { dispute-id: uint }
  {
    agreement-id: uint,
    initiator: principal,
    status: uint,
    created-at: uint,
    voting-ends-at: (optional uint),
    landlord-votes: uint,
    tenant-votes: uint,
    resolution: (optional bool) ;; true for landlord, false for tenant
  }
)

(define-map arbitrators
  { user: principal }
  { stake: uint }
)

(define-map votes
  { dispute-id: uint, voter: principal }
  bool ;; true for landlord, false for tenant
)

(define-map dispute-counter principal uint)

;; Private helpers
(define-private (is-admin)
  (is-eq tx-sender (var-get admin))
)

(define-private (is-valid-agreement (agreement-id uint))
  (is-some (contract-call? (var-get rental-agreement) get-agreement agreement-id))
)

(define-private (is-agreement-party (agreement-id uint) (caller principal))
  (let
    (
      (agreement (unwrap! (contract-call? (var-get rental-agreement) get-agreement agreement-id) (err ERR-INVALID-DISPUTE)))
    )
    (or
      (is-eq caller (get landlord agreement))
      (is-eq caller (unwrap! (get tenant agreement) (err ERR-INVALID-DISPUTE)))
    )
  )
)

(define-private (is-arbitrator (user principal))
  (>= (default-to u0 (get stake (map-get? arbitrators { user: user }))) (var-get min-stake))
)

(define-private (is-voting-open (dispute-id uint))
  (let
    (
      (dispute (unwrap! (map-get? disputes { dispute-id: dispute-id }) (err ERR-NOT-FOUND)))
    )
    (and
      (is-eq (get status dispute) STATUS-VOTING)
      (is-some (get voting-ends-at dispute))
      (<= block-height (unwrap! (get voting-ends-at dispute) (err ERR-VOTING-CLOSED)))
    )
  )
)

(define-private (is-valid-dispute (dispute-id uint))
  (is-some (map-get? disputes { dispute-id: dispute-id }))
)

;; Admin functions
(define-public (set-rental-agreement (contract principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq contract 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (var-set rental-agreement contract)
    (ok true)
  )
)

(define-public (set-escrow-vault (contract principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq contract 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (var-set escrow-vault contract)
    (ok true)
  )
)

(define-public (set-min-stake (amount uint))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (> amount u0) (err ERR-INVALID-AMOUNT))
    (var-set min-stake amount)
    (ok true)
  )
)

(define-public (set-voting-period (blocks uint))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (> blocks u0) (err ERR-INVALID-AMOUNT))
    (var-set voting-period blocks)
    (ok true)
  )
)

;; Arbitrator functions
(define-public (stake-arbitrator (amount uint))
  (begin
    (asserts! (> amount (var-get min-stake)) (err ERR-INVALID-AMOUNT))
    (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
    (map-set arbitrators
      { user: tx-sender }
      { stake: (+ amount (default-to u0 (get stake (map-get? arbitrators { user: tx-sender })))) }
    )
    (ok true)
  )
)

(define-public (unstake-arbitrator (amount uint))
  (let
    (
      (current-stake (default-to u0 (get stake (map-get? arbitrators { user: tx-sender }))))
    )
    (asserts! (>= current-stake amount) (err ERR-INSUFFICIENT-STAKE))
    (asserts! (> current-stake amount) (err ERR-INVALID-AMOUNT))
    (try! (as-contract (stx-transfer? amount tx-sender tx-sender)))
    (map-set arbitrators
      { user: tx-sender }
      { stake: (- current-stake amount) }
    )
    (ok true)
  )
)

;; Dispute functions
(define-public (initiate-dispute (agreement-id uint))
  (let
    (
      (initiator tx-sender)
      (dispute-id (+ (default-to u0 (map-get? dispute-counter initiator)) u1))
    )
    (asserts! (is-valid-agreement agreement-id) (err ERR-INVALID-DISPUTE))
    (asserts! (is-agreement-party agreement-id initiator) (err ERR-NOT-AUTHORIZED))
    (asserts! (is-none (map-get? disputes { dispute-id: dispute-id })) (err ERR-INVALID-DISPUTE))
    (try! (contract-call? (var-get escrow-vault) lock-funds agreement-id))
    (map-set disputes
      { dispute-id: dispute-id }
      {
        agreement-id: agreement-id,
        initiator: initiator,
        status: STATUS-INITIATED,
        created-at: block-height,
        voting-ends-at: none,
        landlord-votes: u0,
        tenant-votes: u0,
        resolution: none
      }
    )
    (map-set dispute-counter initiator dispute-id)
    (ok dispute-id)
  )
)

(define-public (start-voting (dispute-id uint))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (is-valid-dispute dispute-id) (err ERR-NOT-FOUND))
    (let
      (
        (dispute (unwrap! (map-get? disputes { dispute-id: dispute-id }) (err ERR-NOT-FOUND)))
      )
      (asserts! (is-eq (get status dispute) STATUS-INITIATED) (err ERR-INVALID-STATUS))
      (map-set disputes
        { dispute-id: dispute-id }
        (merge dispute { status: STATUS-VOTING, voting-ends-at: (some (+ block-height (var-get voting-period))) })
      )
      (ok true)
    )
  )
)

(define-public (vote (dispute-id uint) (vote-for-landlord bool))
  (let
    (
      (voter tx-sender)
      (dispute (unwrap! (map-get? disputes { dispute-id: dispute-id }) (err ERR-NOT-FOUND)))
    )
    (asserts! (is-arbitrator voter) (err ERR-NOT-AUTHORIZED))
    (asserts! (is-voting-open dispute-id) (err ERR-VOTING-CLOSED))
    (asserts! (is-none (map-get? votes { dispute-id: dispute-id, voter: voter })) (err ERR-ALREADY-VOTED))
    (map-set votes { dispute-id: dispute-id, voter: voter } vote-for-landlord)
    (map-set disputes
      { dispute-id: dispute-id }
      (merge dispute
        {
          landlord-votes: (if vote-for-landlord (+ (get landlord-votes dispute) u1) (get landlord-votes dispute)),
          tenant-votes: (if vote-for-landlord (get tenant-votes dispute) (+ (get tenant-votes dispute) u1))
        }
      )
    )
    (ok true)
  )
)

(define-public (resolve-dispute (dispute-id uint))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (is-valid-dispute dispute-id) (err ERR-NOT-FOUND))
    (let
      (
        (dispute (unwrap! (map-get? disputes { dispute-id: dispute-id }) (err ERR-NOT-FOUND)))
        (agreement-id (get agreement-id dispute))
        (agreement (unwrap! (contract-call? (var-get rental-agreement) get-agreement agreement-id) (err ERR-INVALID-DISPUTE)))
        (landlord (get landlord agreement))
        (tenant (unwrap! (get tenant agreement) (err ERR-INVALID-DISPUTE)))
      )
      (asserts! (is-eq (get status dispute) STATUS-VOTING) (err ERR-INVALID-STATUS))
      (asserts! (> (unwrap! (get voting-ends-at dispute) (err ERR-VOTING-CLOSED)) block-height) (err ERR-VOTING-CLOSED))
      (let
        (
          (resolution (if (>= (get landlord-votes dispute) (get tenant-votes dispute)) true false))
          (recipient (if resolution landlord tenant))
        )
        (try! (contract-call? (var-get escrow-vault) release-deposit agreement-id recipient))
        (try! (contract-call? (var-get escrow-vault) release-rent agreement-id recipient))
        (try! (contract-call? (var-get escrow-vault) unlock-funds agreement-id))
        (map-set disputes
          { dispute-id: dispute-id }
          (merge dispute { status: STATUS-RESOLVED, resolution: (some resolution) })
        )
        (ok true)
      )
    )
  )
)

(define-public (cancel-dispute (dispute-id uint))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (is-valid-dispute dispute-id) (err ERR-NOT-FOUND))
    (let
      (
        (dispute (unwrap! (map-get? disputes { dispute-id: dispute-id }) (err ERR-NOT-FOUND)))
        (agreement-id (get agreement-id dispute))
      )
      (asserts! (is-eq (get status dispute) STATUS-INITIATED) (err ERR-INVALID-STATUS))
      (try! (contract-call? (var-get escrow-vault) unlock-funds agreement-id))
      (map-set disputes
        { dispute-id: dispute-id }
        (merge dispute { status: STATUS-CANCELLED })
      )
      (ok true)
    )
  )
)

;; Read-only functions
(define-read-only (get-dispute (dispute-id uint))
  (ok (unwrap! (map-get? disputes { dispute-id: dispute-id }) (err ERR-NOT-FOUND)))
)

(define-read-only (get-arbitrator-stake (user principal))
  (ok (default-to u0 (get stake (map-get? arbitrators { user: user }))))
)

(define-read-only (get-vote (dispute-id uint) (voter principal))
  (ok (map-get? votes { dispute-id: dispute-id, voter: voter }))
)

(define-read-only (get-dispute-count (initiator principal))
  (ok (default-to u0 (map-get? dispute-counter initiator)))
)

(define-read-only (get-min-stake)
  (ok (var-get min-stake))
)

(define-read-only (get-voting-period)
  (ok (var-get voting-period))
)