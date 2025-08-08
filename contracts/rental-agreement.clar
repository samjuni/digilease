;; RentalAgreement.clar
;; Clarity v2
;; Manages creation, acceptance, termination, and tracking of rental agreements

;; Constants
(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-PROPERTY u101)
(define-constant ERR-INVALID-AMOUNT u102)
(define-constant ERR-ALREADY-EXISTS u103)
(define-constant ERR-NOT-FOUND u104)
(define-constant ERR-INVALID-STATUS u105)
(define-constant ERR-INVALID-DATE u106)
(define-constant ERR-TERMINATION-NOT-ALLOWED u107)
(define-constant ERR-ESCROW-VAULT u108)
(define-constant ERR-ZERO-ADDRESS u109)

;; Status enum
(define-constant STATUS-PENDING u0)
(define-constant STATUS-ACTIVE u1)
(define-constant STATUS-TERMINATED u2)
(define-constant STATUS-DISPUTED u3)

;; Data structures
(define-data-var admin principal tx-sender)
(define-data-var escrow-vault principal 'SP000000000000000000002Q6VF78) ;; Placeholder for EscrowVault contract

(define-map agreements
  { agreement-id: uint }
  {
    landlord: principal,
    tenant: (optional principal),
    property-id: uint,
    rent-amount: uint,
    deposit-amount: uint,
    start-date: uint,
    end-date: uint,
    late-fee: uint,
    status: uint,
    created-at: uint,
    last-payment: (optional uint)
  }
)

(define-map agreement-counter principal uint)

;; Private helpers
(define-private (is-admin)
  (is-eq tx-sender (var-get admin))
)

(define-private (is-valid-date (date uint))
  (>= date block-height)
)

(define-private (is-valid-status-transition (current uint) (new uint))
  (or
    (and (is-eq current STATUS-PENDING) (is-eq new STATUS-ACTIVE))
    (and (is-eq current STATUS-ACTIVE) (or (is-eq new STATUS-TERMINATED) (is-eq new STATUS-DISPUTED)))
    (and (is-eq current STATUS-DISPUTED) (is-eq new STATUS-TERMINATED))
  )
)

(define-private (check-property-exists (property-id uint))
  (is-some (contract-call? .PropertyRegistry get-property property-id))
)

;; Admin functions
(define-public (set-escrow-vault (vault principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq vault 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (var-set escrow-vault vault)
    (ok true)
  )
)

;; Create agreement
(define-public (create-agreement
  (property-id uint)
  (rent-amount uint)
  (deposit-amount uint)
  (start-date uint)
  (end-date uint)
  (late-fee uint))
  (begin
    (asserts! (> rent-amount u0) (err ERR-INVALID-AMOUNT))
    (asserts! (> deposit-amount u0) (err ERR-INVALID-AMOUNT))
    (asserts! (is-valid-date start-date) (err ERR-INVALID-DATE))
    (asserts! (> end-date start-date) (err ERR-INVALID-DATE))
    (asserts! (check-property-exists property-id) (err ERR-INVALID-PROPERTY))
    (let
      (
        (landlord tx-sender)
        (agreement-id (+ (default-to u0 (map-get? agreement-counter landlord)) u1))
      )
      (asserts! (is-none (map-get? agreements { agreement-id: agreement-id })) (err ERR-ALREADY-EXISTS))
      (map-set agreements
        { agreement-id: agreement-id }
        {
          landlord: landlord,
          tenant: none,
          property-id: property-id,
          rent-amount: rent-amount,
          deposit-amount: deposit-amount,
          start-date: start-date,
          end-date: end-date,
          late-fee: late-fee,
          status: STATUS-PENDING,
          created-at: block-height,
          last-payment: none
        }
      )
      (map-set agreement-counter landlord agreement-id)
      (ok agreement-id)
    )
  )
)

;; Accept agreement
(define-public (accept-agreement (agreement-id uint))
  (let
    (
      (agreement (unwrap! (map-get? agreements { agreement-id: agreement-id }) (err ERR-NOT-FOUND)))
      (tenant tx-sender)
    )
    (asserts! (is-eq (get status agreement) STATUS-PENDING) (err ERR-INVALID-STATUS))
    (asserts! (is-none (get tenant agreement)) (err ERR-ALREADY-EXISTS))
    (try! (contract-call? (var-get escrow-vault) deposit tenant (get deposit-amount agreement)))
    (map-set agreements
      { agreement-id: agreement-id }
      (merge agreement { tenant: (some tenant), status: STATUS-ACTIVE })
    )
    (ok true)
  )
)

;; Record payment
(define-public (record-payment (agreement-id uint))
  (let
    (
      (agreement (unwrap! (map-get? agreements { agreement-id: agreement-id }) (err ERR-NOT-FOUND)))
      (tenant tx-sender)
    )
    (asserts! (is-eq (get status agreement) STATUS-ACTIVE) (err ERR-INVALID-STATUS))
    (asserts! (is-eq (unwrap! (get tenant agreement) (err ERR-NOT-FOUND)) tenant) (err ERR-NOT-AUTHORIZED))
    (try! (contract-call? (var-get escrow-vault) deposit tenant (get rent-amount agreement)))
    (map-set agreements
      { agreement-id: agreement-id }
      (merge agreement { last-payment: (some block-height) })
    )
    (ok true)
  )
)

;; Terminate agreement
(define-public (terminate-agreement (agreement-id uint))
  (let
    (
      (agreement (unwrap! (map-get? agreements { agreement-id: agreement-id }) (err ERR-NOT-FOUND)))
      (caller tx-sender)
    )
    (asserts! (or (is-eq caller (get landlord agreement)) (is-eq caller (unwrap! (get tenant agreement) (err ERR-NOT-FOUND)))) (err ERR-NOT-AUTHORIZED))
    (asserts! (is-valid-status-transition (get status agreement) STATUS-TERMINATED) (err ERR-INVALID-STATUS))
    (asserts! (>= block-height (get end-date agreement)) (err ERR-TERMINATION-NOT-ALLOWED))
    (try! (contract-call? (var-get escrow-vault) release-deposit (get landlord agreement) (get deposit-amount agreement)))
    (map-set agreements
      { agreement-id: agreement-id }
      (merge agreement { status: STATUS-TERMINATED })
    )
    (ok true)
  )
)

;; Initiate dispute
(define-public (initiate-dispute (agreement-id uint))
  (let
    (
      (agreement (unwrap! (map-get? agreements { agreement-id: agreement-id }) (err ERR-NOT-FOUND)))
      (caller tx-sender)
    )
    (asserts! (or (is-eq caller (get landlord agreement)) (is-eq caller (unwrap! (get tenant agreement) (err ERR-NOT-FOUND)))) (err ERR-NOT-AUTHORIZED))
    (asserts! (is-eq (get status agreement) STATUS-ACTIVE) (err ERR-INVALID-STATUS))
    (map-set agreements
      { agreement-id: agreement-id }
      (merge agreement { status: STATUS-DISPUTED })
    )
    (ok true)
  )
)

;; Read-only functions
(define-read-only (get-agreement (agreement-id uint))
  (ok (unwrap! (map-get? agreements { agreement-id: agreement-id }) (err ERR-NOT-FOUND)))
)

(define-read-only (get-agreement-count (landlord principal))
  (ok (default-to u0 (map-get? agreement-counter landlord)))
)

(define-read-only (get-escrow-vault)
  (ok (var-get escrow-vault))
)