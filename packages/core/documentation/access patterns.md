You're absolutely right! I focused on the changes and dropped many access patterns. Let me provide the complete comprehensive schema with ALL original access patterns plus the updates:

# Enhanced Rasika.life DynamoDB Single-Table Design (Complete)

## Table Structure

| Access Pattern | PK | SK | GSI1PK | GSI1SK | GSI2PK | GSI2SK | GSI3PK | GSI3SK | GSI4PK | GSI4SK | LSI1SK | Attributes |
|----------------|----|----|--------|--------|--------|--------|--------|--------|--------|--------|--------|------------|
| **User Profiles** |
| Get user by ID | `USER#id` | `#METADATA` | `EMAIL#email` | `USER#id` | | | | | | | | `username`, `email`, `displayName`, `bio`, `profileImage`, `createdAt`, `updatedAt`, `roles: []`, `karma`, `isVerified`, `preferences`, `notificationSettings`, `lastLoginAt`, `privacySettings` |
| Get user by email | `USER#id` | `#METADATA` | `EMAIL#email` | `USER#id` | | | | | | | | *same as above* |
| Get user by username | `USER#id` | `#METADATA` | | | `USERNAME#username` | `USER#id` | | | | | | *same as above* |
| List users by role | `USER#id` | `#METADATA` | | | | | `ROLE#role` | `KARMA#score#USER#id` | | | | *same as above* |
| Get user's subscription | `USER#id` | `SUBSCRIPTION#id` | `SUBSCRIPTION#status` | `USER#id#DATE#yyyy-mm-dd` | | | | | | | | `planType`, `startDate`, `endDate`, `status`, `autoRenew`, `paymentMethod` |
| **Karma System** |
| Get user karma history | `USER#id` | `KARMA#timestamp` | | | | | | | | | | `value`, `changeAmount`, `reason`, `sourceId`, `sourceType` |
| Get user badges | `USER#id` | `BADGE#badgeId` | `BADGE#badgeId` | `USER#id` | | | | | | | | `badgeName`, `description`, `awardedAt`, `category`, `level` |
| Get badge recipients | `BADGE#id` | `USER#userId` | `USER#userId` | `BADGE#badgeId` | | | | | | | | `awardedAt` |
| Karma permission thresholds | `PERMISSION#action` | `THRESHOLD#karmaValue` | | | | | | | | | | `description`, `requiredKarma` |
| **Karma-Based Permissions** |
| Get karma permission rules | `KARMA_RULE#entityType` | `PERMISSION#action` | | | | | | | | | | `minKarma`, `description`, `autoGranted`, `scope` |
| Get user's karma permissions | `USER#id` | `KARMA_PERMISSION#entityType#action` | `KARMA#level` | `USER#id` | | | | | | | | `grantedAt`, `source`, `scope` |
| **User Relationships** |
| User following artists | `USER#id` | `FOLLOWS#ARTIST#artistId` | | | | | `ARTIST#artistId` | `FOLLOWER#userId` | | | | `followedAt` |
| Artist followers | `ARTIST#id` | `FOLLOWER#userId` | | | | | `USER#userId` | `FOLLOWS#ARTIST#artistId` | | | | `followedAt` |
| User following users | `USER#id` | `FOLLOWS#USER#userId` | | | | | `USER#followedId` | `FOLLOWER#userId` | | | | `followedAt` |
| **Artist Profiles** |
| Get artist by ID | `ARTIST#id` | `#METADATA` | `ARTIST_NAME#name` | `ARTIST#id` | | | | | | | | `name`, `bio`, `artistType`, `instruments: []`, `gurus: []`, `lineage`, `formationYear`, `isVerified`, `verificationStatus`, `viewCount`, `favoriteCount`, `popularityScore`, `location`, `profileImage`, `socialLinks`, `website`, `privacySettings`, `traditions: []` |
| List artists by instrument | `ARTIST#id` | `#METADATA` | | | `INSTRUMENT#name` | `ARTIST#id` | | | | | | *same as above* |
| List artists by guru/lineage | `ARTIST#id` | `#METADATA` | | | `GURU#name` | `ARTIST#id` | | | | | | *same as above* |
| List artists by location | `ARTIST#id` | `#METADATA` | | | | | | | `LOCATION#country#state#city` | `ARTIST#id` | | *same as above* |
| List artists by popularity | `ARTIST#id` | `#METADATA` | | | | | `POPULARITY` | `score#ARTIST#id` | | | | *same as above* |
| List artists by tradition | `ARTIST#id` | `#METADATA` | `TRADITION#name` | `ARTIST#id` | | | | | | | | *same as above* |
| **Artist Management (NEW)** |
| Get artist managers | `ARTIST#id` | `MANAGER#userId` | `USER#userId` | `MANAGES#ARTIST#artistId` | | | | | | | | `permissions: {}`, `grantedBy`, `grantedAt`, `expiresAt`, `status` |
| Get user's managed artists | `USER#id` | `MANAGES#ARTIST#artistId` | `ARTIST#artistId` | `MANAGER#userId` | | | | | | | | `permissions: {}`, `grantedBy`, `grantedAt`, `expiresAt`, `status` |
| **Artist Management with Karma** |
| Get artist managers (enhanced) | `ARTIST#id` | `MANAGER#userId` | `USER#userId` | `MANAGES#ARTIST#artistId` | | | | | | | | `permissions: {}`, `grantedBy`, `grantedAt`, `expiresAt`, `status`, `permissionSource: "explicit,karma,karmaAtGrant"` |
| **Community Artist Profiles** |
| Get community-managed artists | `ARTIST#community` | `ARTIST#artistId` | `KARMA_MANAGED` | `ARTIST#artistId` | | | | | | | | `minKarmaToEdit`, `minKarmaToApprove`, `protectionLevel` |
| **Artist Groups (NEW)** |
| Get group members | `ARTIST#groupId` | `MEMBER#artistId` | `ARTIST#artistId` | `MEMBEROF#groupId` | | | | | | | | `role`, `joinedDate`, `leftDate`, `isCurrentMember` |
| Get artist's groups | `ARTIST#artistId` | `MEMBEROF#groupId` | `ARTIST#groupId` | `MEMBER#artistId` | | | | | | | | `role`, `joinedDate`, `leftDate`, `isCurrentMember` |
| **Knowledge Base - Compositions** |
| Get composition by ID | `COMPOSITION#id` | `VERSION#v#timestamp` | | | | | | | | | `CREATED#timestamp` | `title`, `canonicalTitle`, `alternativeTitles: []`, `language`, `verses`, `meaning`, `notation`, `audioSamples: []`, `videoSamples: []`, `dateAdded`, `lastUpdated`, `addedBy`, `editedBy: []`, `viewCount`, `favoriteCount`, `popularityScore`, `sourceAttribution`, `tradition` |
| Get latest composition | `COMPOSITION#id` | `VERSION#LATEST` | | | | | | | | | | *reference to latest version* |
| List compositions by raga | `COMPOSITION#id` | `VERSION#LATEST` | `RAGA#name` | `COMPOSITION#id` | | | | | | | | *same as above* |
| List compositions by composer | `COMPOSITION#id` | `VERSION#LATEST` | | | `COMPOSER#name` | `COMPOSITION#id` | | | | | | *same as above* |
| List compositions by tala | `COMPOSITION#id` | `VERSION#LATEST` | | | | | `TALA#name` | `COMPOSITION#id` | | | | *same as above* |
| List compositions by language | `COMPOSITION#id` | `VERSION#LATEST` | | | `LANGUAGE#name` | `COMP#id` | | | | | | *same as above* |
| List compositions by popularity | `COMPOSITION#id` | `VERSION#LATEST` | | | | | `POPULARITY` | `score#COMPOSITION#id` | | | | *same as above* |
| List compositions by tradition | `COMPOSITION#id` | `VERSION#LATEST` | `TRADITION#name` | `COMPOSITION#id` | | | | | | | | *same as above* |
| Get composition edit history | `COMPOSITION#id` | `VERSION#v#timestamp` | | | | | | | | | | *includes version metadata and editor information* |
| **Composition Attribution (NEW)** |
| Get composition attributions | `COMPOSITION#id` | `ATTRIBUTION#artistId` | `ARTIST#artistId` | `COMPOSES#compositionId` | | | | | | | | `attributionType`, `confidence`, `source`, `notes`, `addedBy`, `verifiedBy: []`, `createdAt` |
| Get artist's compositions | `ARTIST#id` | `COMPOSES#compositionId` | `COMPOSITION#compositionId` | `ATTRIBUTION#artistId` | | | | | | | | `attributionType`, `confidence`, `source`, `notes`, `addedBy`, `verifiedBy: []`, `createdAt` |
| List disputed attributions | `COMPOSITION#id` | `ATTRIBUTION#artistId` | `ATTRIBUTION_TYPE#disputed` | `COMPOSITION#id` | | | | | | | | *same as attribution* |
| **Knowledge Base - Ragas** |
| Get raga by ID | `RAGA#id` | `VERSION#v#timestamp` | `RAGA_NAME#name` | `RAGA#id` | | | | | | | `CREATED#timestamp` | `name`, `alternativeNames: []`, `melakarta`, `janaka`, `arohanam`, `avarohanam`, `notes`, `characteristicPhrases`, `mood`, `timeOfDay`, `history`, `famousCompositions: []`, `viewCount`, `editedBy: []`, `tradition` |
| Get latest raga | `RAGA#id` | `VERSION#LATEST` | | | | | | | | | | *reference to latest version* |
| Get raga by name | `RAGA#id` | `VERSION#LATEST` | `RAGA_NAME#name` | `RAGA#id` | | | | | | | | *same as above* |
| List ragas by melakarta | `RAGA#id` | `VERSION#LATEST` | | | `MELAKARTA#number` | `RAGA#id` | | | | | | *same as above* |
| List ragas by tradition | `RAGA#id` | `VERSION#LATEST` | `TRADITION#name` | `RAGA#id` | | | | | | | | *same as above* |
| Get raga edit history | `RAGA#id` | `VERSION#v#timestamp` | | | | | | | | | | *includes version metadata and editor information* |
| **Knowledge Base - Talas** |
| Get tala by ID | `TALA#id` | `VERSION#v#timestamp` | `TALA_NAME#name` | `TALA#id` | | | | | | | `CREATED#timestamp` | `name`, `alternativeNames: []`, `type`, `aksharas`, `structure`, `notation`, `examples: []`, `viewCount`, `editedBy: []`, `tradition` |
| Get latest tala | `TALA#id` | `VERSION#LATEST` | | | | | | | | | | *reference to latest version* |
| Get tala by name | `TALA#id` | `VERSION#LATEST` | `TALA_NAME#name` | `TALA#id` | | | | | | | | *same as above* |
| List talas by tradition | `TALA#id` | `VERSION#LATEST` | `TRADITION#name` | `TALA#id` | | | | | | | | *same as above* |
| Get tala edit history | `TALA#id` | `VERSION#v#timestamp` | | | | | | | | | | *includes version metadata and editor information* |
| **Name Variations & Aliases** |
| Lookup canonical from variant | `VARIANT#type#variant` | `#METADATA` | | | | | | | | | | `canonicalId`, `canonicalName`, `type` (raga/tala/composer), `addedBy`, `createdAt` |
| **Events** |
| Get event by ID | `EVENT#id` | `#METADATA` | | | | | | | | | | `title`, `description`, `startDate`, `endDate`, `location`, `venue`, `venueId`, `eventType`, `ticketInfo`, `organizer`, `organizerId`, `isVerified`, `isFeatured`, `image`, `status`, `isVirtual`, `streamingUrl`, `seriesId`, `recurrenceRule` |
| List upcoming events | `EVENT#id` | `#METADATA` | `STATUS#status` | `DATE#yyyy-mm-dd#EVENT#id` | | | | | | | | *same as above* |
| List events by date range | `EVENT#id` | `#METADATA` | `STATUS#status` | `DATE#yyyy-mm-dd#EVENT#id` | | | | | | | | *same as above* |
| List events by location | `EVENT#id` | `#METADATA` | | | | | | | `LOCATION#country#state#city` | `DATE#yyyy-mm-dd#EVENT#id` | | *same as above* |
| List events by venue | `EVENT#id` | `#METADATA` | | | | | `VENUE#id` | `DATE#yyyy-mm-dd#EVENT#id` | | | | *same as above* |
| List events by type | `EVENT#id` | `#METADATA` | | | `EVENT_TYPE#type` | `DATE#yyyy-mm-dd#EVENT#id` | | | | | | *same as above* |
| List events by series | `EVENT#id` | `#METADATA` | | | `SERIES#id` | `DATE#yyyy-mm-dd#EVENT#id` | | | | | | *same as above* |
| List featured events | `EVENT#id` | `#METADATA` | `FEATURED#true` | `DATE#yyyy-mm-dd#EVENT#id` | | | | | | | | *same as above* |
| **Event Series** |
| Get event series | `SERIES#id` | `#METADATA` | | | | | | | | | | `name`, `description`, `organizer`, `recurrenceRule`, `startDate`, `endDate`, `venues: []`, `eventCount` |
| **Event Participants** |
| Artist-Event mapping | `EVENT#id` | `ARTIST#artistId` | `ARTIST#artistId` | `EVENT#eventId#DATE#yyyy-mm-dd` | | | | | | | | `role`, `order`, `isConfirmed` |
| Artist's events | `ARTIST#id` | `EVENT#eventId` | `EVENT#eventId` | `ARTIST#artistId` | | | | | | | | `role`, `order`, `isConfirmed` |
| **Performances (NEW STRUCTURE)** |
| Get performance by ID | `PERFORMANCE#id` | `#METADATA` | | | | | | | | | | `eventId`, `startTime`, `endTime`, `orderInEvent`, `createdAt`, `updatedAt` |
| List performances by event | `EVENT#id` | `PERFORMANCE#performanceId` | `PERFORMANCE#id` | `#METADATA` | | | | | | | | *reference to actual performance* |
| **Performance Compositions (NEW - MANY-TO-MANY)** |
| Get performance compositions | `PERFORMANCE#id` | `COMPOSITION#compositionId#order` | `COMPOSITION#compositionId` | `PERFORMANCE#performanceId` | | | | | | | | `orderInPerformance`, `ragaId`, `talaId`, `duration`, `notes` |
| Get composition performances | `COMPOSITION#id` | `PERFORMANCE#performanceId#date` | `PERFORMANCE#performanceId` | `COMPOSITION#compositionId` | | | | | | | | `orderInPerformance`, `ragaId`, `talaId`, `duration`, `notes` |
| **Performance Artists (NEW)** |
| Get performance artists | `PERFORMANCE#id` | `ARTIST#artistId` | `ARTIST#artistId` | `PERFORMS#performanceId` | | | | | | | | `role`, `instrument`, `isPrimaryArtist` |
| Get artist performances | `ARTIST#id` | `PERFORMS#performanceId#date` | `PERFORMANCE#performanceId` | `ARTIST#artistId` | | | | | | | | `role`, `instrument`, `isPrimaryArtist` |
| **Recording (NEW)** |
| Get recording by ID | `RECORDING#id` | `#METADATA` | | | | | | | | | | `performanceId`, `url`, `type`, `duration`, `quality`, `source`, `metadata` |
| List recordings by performance | `PERFORMANCE#id` | `RECORDING#recordingId` | `RECORDING#id` | `#METADATA` | | | | | | | | *reference to actual recording* |
| **Venues** |
| Get venue by ID | `VENUE#id` | `#METADATA` | | | | | | | | | | `name`, `address`, `city`, `state`, `country`, `capacity`, `facilities: []`, `contact`, `website`, `images: []`, `isVerified`, `partnershipStatus`, `virtualCapabilities` |
| List venues by location | `VENUE#id` | `#METADATA` | | | | | | | `LOCATION#country#state#city` | `VENUE#id` | | *same as above* |
| List venues by capacity | `VENUE#id` | `#METADATA` | | | `CAPACITY` | `size#VENUE#id` | | | | | | *same as above* |
| List venues by partnership | `VENUE#id` | `#METADATA` | `PARTNERSHIP#status` | `VENUE#id` | | | | | | | | *same as above* |
| List featured venues | `VENUE#id` | `#METADATA` | `FEATURED#true` | `VENUE#id` | | | | | | | | *same as above* |
| **Artist Updates/Posts** |
| Get update by ID | `UPDATE#id` | `#METADATA` | | | | | | | | | | `content`, `artistId`, `userId`, `createdAt`, `media: []`, `tags: []`, `likeCount`, `commentCount`, `shareCount`, `source` (web/whatsapp) |
| List updates by artist | `ARTIST#id` | `UPDATE#updateId#yyyy-mm-dd` | `UPDATE#id` | `#METADATA` | | | | | | | | *reference to actual update* |
| List updates by timestamp | `UPDATE#id` | `#METADATA` | `TYPE#UPDATE` | `DATE#yyyy-mm-dd#hh-mm#UPDATE#id` | | | | | | | | *same as above* |
| User feed | `USER#id` | `FEED#yyyy-mm-dd#updateId` | | | | | | | | | | `updateId`, `artistId`, `timestamp`, `preview`, `type` |
| Featured updates | `UPDATE#id` | `#METADATA` | `FEATURED#true` | `DATE#yyyy-mm-dd#UPDATE#id` | | | | | | | | *same as update* |
| **WhatsApp Integration** |
| WhatsApp user linking | `WHATSAPP#number` | `#METADATA` | | | | | | | | | | `userId`, `artistId`, `isVerified`, `verificationCode`, `lastActive`, `lastMessageSent`, `conversationState` |
| Process WhatsApp message | `WHATSAPP#number` | `MSG#timestamp#messageId` | | | | | | | | | | `content`, `media: []`, `processedStatus`, `entityExtraction: {}` |
| WhatsApp message templates | `TEMPLATE#id` | `#METADATA` | `TEMPLATE_TYPE#type` | `TEMPLATE#id` | | | | | | | | `content`, `variables: []`, `description`, `useCase` |
| **WhatsApp Conversation Workflows** |
| WhatsApp conversation state | `WHATSAPP#number` | `CONVO#timestamp` | | | | | | | | | | `flowId`, `currentStep`, `collectedData: {}`, `expiresAt` |
| WhatsApp conversation flow | `FLOW#id` | `STEP#stepId` | | | | | | | | | | `prompt`, `responseType`, `nextSteps: {}`, `validations: []` |
| **User Interactions** |
| User favorites | `USER#id` | `FAVORITE#type#itemId` | `TYPE#FAVORITE#type` | `ITEM#itemId` | | | | | | | | `favoriteAt`, `type` (artist/composition/event) |
| Item favorites | `TYPE#type#itemId` | `FAVORITE#userId` | | | | | | | | | | `favoriteAt` |
| User votes | `USER#id` | `VOTE#type#itemId` | `TYPE#VOTE#type` | `ITEM#itemId` | | | | | | | | `voteType` (up/down), `votedAt` |
| Item votes | `TYPE#type#itemId` | `VOTE#userId` | `VOTE_TYPE#voteType` | `USER#userId` | | | | | | | | `votedAt` |
| View counts (sharded) | `VIEW#type#itemId#shard` | `DATE#yyyy-mm-dd` | | | | | | | | | | `count` |
| User history | `USER#id` | `HISTORY#type#itemId#timestamp` | `TYPE#HISTORY#type` | `DATE#yyyy-mm-dd#USER#id` | | | | | | | | `duration`, `context` |
| **Forum/Discussions** |
| Get thread by ID | `THREAD#id` | `#METADATA` | | | | | | | | | | `title`, `content`, `authorId`, `createdAt`, `updatedAt`, `category`, `tags: []`, `status`, `viewCount`, `replyCount`, `lastReplyAt`, `lastReplyId`, `isSticky`, `isPinned` |
| List threads by category | `THREAD#id` | `#METADATA` | `CATEGORY#name` | `DATE#yyyy-mm-dd#THREAD#id` | | | | | | | | *same as above* |
| List threads by tag | `THREAD#id` | `#METADATA` | | | `TAG#name` | `DATE#yyyy-mm-dd#THREAD#id` | | | | | | *same as above* |
| List threads by author | `USER#id` | `THREAD#threadId#yyyy-mm-dd` | `THREAD#threadId` | `#METADATA` | | | | | | | | *reference to actual thread* |
| List threads by artist | `ARTIST#id` | `THREAD#threadId#yyyy-mm-dd` | `THREAD#threadId` | `#METADATA` | | | | | | | | *reference to actual thread* |
| Get thread replies | `THREAD#id` | `REPLY#yyyy-mm-dd#timestamp#replyId` | | | | | | | | | | `content`, `authorId`, `createdAt`, `parentReplyId`, `isAccepted`, `voteCount` |
| User's thread subscriptions | `USER#id` | `SUBSCRIBES#THREAD#threadId` | `THREAD#threadId` | `SUBSCRIBER#userId` | | | | | | | | `subscribedAt` |
| Featured threads | `THREAD#id` | `#METADATA` | `FEATURED#true` | `DATE#yyyy-mm-dd#THREAD#id` | | | | | | | | *same as thread* |
| **Moderation** |
| Moderation queue | `MODERATION#status` | `ITEM#type#id#timestamp` | `TYPE#type` | `DATE#yyyy-mm-dd#ITEM#id` | | | | | | | | `reportCount`, `reportReason`, `assignedTo`, `priority` |
| Flagged content | `ITEM#type#id` | `FLAG#userId#timestamp` | `USER#userId` | `FLAG#ITEM#type#id` | | | | | | | | `reason`, `details`, `status` |
| Moderation action | `ITEM#type#id` | `MOD_ACTION#timestamp` | `MOD_ACTION_TYPE#type` | `DATE#yyyy-mm-dd` | | | | | | | | `actionType`, `moderatorId`, `reason`, `details` |
| **Approval Requests (NEW)** |
| Get pending approvals | `APPROVAL#status` | `REQUEST#id#timestamp` | `TYPE#entityType` | `REQUEST#id` | | | | | | | | `entityId`, `changeType`, `proposedChanges`, `requestedBy`, `requestedAt`, `reviewedBy`, `reviewedAt`, `comments` |
| Get user's requests | `USER#id` | `APPROVAL#id#timestamp` | `APPROVAL#id` | `USER#id` | | | | | | | | *reference to actual request* |
| Get entity approvals | `ENTITY#type#id` | `APPROVAL#id#timestamp` | `APPROVAL#id` | `ENTITY#type#id` | | | | | | | | *reference to actual request* |
| **Ticketing** |
| Get ticket by ID | `TICKET#id` | `#METADATA` | | | | | | | | | | `eventId`, `userId`, `status`, `purchasedAt`, `price`, `currency`, `quantity`, `ticketType`, `barcode`, `isCheckedIn`, `checkedInAt`, `refundStatus` |
| List tickets by event | `EVENT#id` | `TICKET#ticketId` | `TICKET#id` | `#METADATA` | | | | | | | | *reference to actual ticket* |
| List tickets by user | `USER#id` | `TICKET#ticketId#yyyy-mm-dd` | `TICKET#id` | `#METADATA` | | | | | | | | *reference to actual ticket* |
| List tickets by status | `TICKET#id` | `#METADATA` | `STATUS#status` | `DATE#yyyy-mm-dd#TICKET#id` | | | | | | | | *same as above* |
| Venue check-in stats | `EVENT#id` | `CHECKIN#timestamp` | | | | | | | | | | `count`, `percentCapacity` |
| **Artist Support/Patronage** |
| Get patron tier by ID | `ARTIST#id` | `TIER#tierId` | | | | | | | | | | `name`, `price`, `currency`, `description`, `benefits: []`, `maxPatrons`, `currentPatrons` |
| Artist's patrons | `ARTIST#id` | `PATRON#userId` | `USER#userId` | `PATRONIZES#ARTIST#artistId` | | | | | | | | `tierId`, `startDate`, `nextBillingDate`, `status` |
| User's patronages | `USER#id` | `PATRONIZES#ARTIST#artistId` | `ARTIST#artistId` | `PATRON#userId` | | | | | | | | `tierId`, `startDate`, `nextBillingDate`, `status` |
| Patron benefit usage | `USER#id` | `BENEFIT#artistId#benefitId` | | | | | | | | | | `benefitName`, `usedAt`, `expiresAt`, `status`, `details` |
| **Content Collections** |
| Get collection by ID | `COLLECTION#id` | `#METADATA` | | | | | | | | | | `title`, `description`, `createdBy`, `isPublic`, `itemCount`, `createdAt`, `updatedAt`, `thumbnailUrl`, `collectionType` |
| Get collection items | `COLLECTION#id` | `ITEM#type#itemId#order` | `TYPE#type` | `ITEM#itemId` | | | | | | | | `addedAt`, `addedBy`, `notes` |
| User collections | `USER#id` | `COLLECTION#collectionId` | `COLLECTION#id` | `USER#userId` | | | | | | | | `isOwner`, `accessLevel` |
| Featured collections | `COLLECTION#id` | `#METADATA` | `FEATURED#true` | `DATE#yyyy-mm-dd#COLLECTION#id` | | | | | | | | *same as collection* |
| **Transactions** |
| Get transaction by ID | `TRANSACTION#id` | `#METADATA` | | | | | | | | | | `userId`, `type`, `amount`, `currency`, `status`, `createdAt`, `completedAt`, `details`, `relatedEntityId`, `relatedEntityType`, `paymentMethod`, `paymentGatewayRef` |
| List transactions by user | `USER#id` | `TRANSACTION#transactionId#yyyy-mm-dd` | `TRANSACTION#id` | `#METADATA` | | | | | | | | *reference to actual transaction* |
| List transactions by date | `TRANSACTION#id` | `#METADATA` | `TYPE#TRANSACTION` | `DATE#yyyy-mm-dd#TRANSACTION#id` | | | | | | | | *same as above* |
| List transactions by type | `TRANSACTION#id` | `#METADATA` | | | `TRANS_TYPE#type` | `DATE#yyyy-mm-dd#TRANSACTION#id` | | | | | | *same as above* |
| List transactions by status | `TRANSACTION#id` | `#METADATA` | `STATUS#status` | `DATE#yyyy-mm-dd#TRANSACTION#id` | | | | | | | | *same as above* |
| Transaction receipts | `RECEIPT#transactionId` | `#METADATA` | `USER#userId` | `RECEIPT#transactionId` | | | | | | | | `receiptUrl`, `items: []`, `taxAmount`, `totalAmount`, `currency` |
| **Search Functionality** |
| Search preferences | `USER#id` | `SEARCH_PREF#prefId` | | | | | | | | | | `preferredFilters: {}`, `preferredSorting`, `savedParams: {}` |
| Search history | `USER#id` | `SEARCH#timestamp#query` | | | | | | | | | | `query`, `filters: {}`, `resultsCount`, `clickedResults: []` |
| Search logs | `SEARCH#query` | `DATE#yyyy-mm-dd` | | | | | | | | | | `count`, `avgResultsClicked`, `topResults: []` |
| Search suggestions | `SEARCH#prefix` | `SUGGEST#term` | | | | | | | | | | `hitCount`, `lastQueried` |
| **Analytics** |
| Daily metrics | `METRIC#name` | `DATE#yyyy-mm-dd` | | | | | | | | | | `value`, `change`, `details` |
| Entity metrics | `METRIC#entityType#id` | `DATE#yyyy-mm-dd` | | | | | | | | | | `views`, `favorites`, `engagement`, `details` |
| User segments | `SEGMENT#id` | `USER#userId` | | | | | | | | | | `addedAt`, `attributes: {}` |
| **Recommendations** |
| User recommendations | `USER#id` | `REC#timestamp#type#itemId` | `TYPE#REC#type` | `DATE#yyyy-mm-dd#USER#id` | | | | | | | | `score`, `reason`, `context`, `isClicked` |
| **Notifications** |
| User notifications | `USER#id` | `NOTIFICATION#yyyy-mm-dd#timestamp#id` | `STATUS#status` | `DATE#yyyy-mm-dd#timestamp` | | | | | | | | `type`, `status`, `content`, `relatedEntityId`, `relatedEntityType`, `timestamp`, `isRead`, `actionUrl` |
| Notification templates | `NOTIFICATION_TEMPLATE#id` | `#METADATA` | `NOTIFICATION_TYPE#type` | `TEMPLATE#id` | | | | | | | | `titleTemplate`, `bodyTemplate`, `variables: []`, `category` |
| **Educational Content** |
| Educational resource | `RESOURCE#id` | `#METADATA` | | | | | | | | | | `title`, `description`, `type`, `content`, `author`, `difficulty`, `targetAudience`, `relatedItems: []`, `tags: []` |
| List resources by category | `RESOURCE#id` | `#METADATA` | `RESOURCE_TYPE#type` | `RESOURCE#id` | | | | | | | | *same as above* |
| List resources by difficulty | `RESOURCE#id` | `#METADATA` | | | `DIFFICULTY#level` | `RESOURCE#id` | | | | | | *same as above* |
| List featured resources | `RESOURCE#id` | `#METADATA` | `FEATURED#true` | `RESOURCE#id` | | | | | | | | *same as above* |
| **Audit Log** |
| Entity audit trail | `ENTITY#type#id` | `AUDIT#yyyy-mm-dd#timestamp` | | | | | | | | | | `action`, `userId`, `changes`, `timestamp`, `metadata` |
| User actions audit | `USER#id` | `AUDIT#yyyy-mm-dd#timestamp` | | | | | | | | | | `action`, `entityId`, `entityType`, `changes`, `timestamp`, `metadata` |
| **ElasticSearch Sync** |
| Sync status | `SYNC#entityType` | `ID#entityId` | | | | | | | | | | `lastSyncedAt`, `status`, `errorDetails` |

