import Chance from 'chance';
import { DEFAULT_VOICE_DURATION_CONFIG, generateVoiceWithEventTimeline } from '../../../src/helpers/voices';


function mockPickoneIndices(indices: number[]): () => void {
  const originalPickone = Chance.prototype.pickone;
  
  let currentIndex = 0;
  
  Chance.prototype.pickone = function<T>(arr: T[]): T {
    const pickIndex = indices[currentIndex];
    currentIndex = (currentIndex + 1) % indices.length;
    return arr[pickIndex];
  };
  
  return () => {
    Chance.prototype.pickone = originalPickone;
  };
}

describe('generateVoiceWithEventTimeline', () => {
    describe('random goal', () => {

    const timeline = [6, 12];
    const eventName = ["goal_A", "goal_A"];

    it('should generate voice for goal', () => {
        // Arrange
        const restore = mockPickoneIndices([0, 0, 0, 0]);
        
        try {
            // Act
            const actual = generateVoiceWithEventTimeline({
                eventName,
                timeline
            }, {
                goal: { 
                    1: 2,
                    2: 1,
                    3: 1
                }
            });

            // Assert
            expect(actual.voice).toEqual(['goal_1_1', 'goal_1_2']);
        } finally {
            restore();
        }
    });

        it('should not generate voice overlapping the previous voice', () => {
            // Arrange
            const restore = mockPickoneIndices([0, 0]);
            
            try {
                const closeTimeline = [5, 6];
                
                // Act
                const actual = generateVoiceWithEventTimeline({
                    eventName,
                    timeline: closeTimeline
                }, {
                    goal: { 
                        3: 1
                    }
                });

                // Assert
                // The second voice is skipped because of the overlapping check,
                // but the timeline still has both entries
                expect(actual.timeline.length).toBe(1);
                expect(actual.voice.length).toBe(1);
                expect(actual.voice[0]).toBe('goal_3_1');
            } finally {
                restore();
            }
        });
    });

    describe("Equalizer 1 - 1", () => {
        const timeline = [10, 20];
        const eventName = ["goal_H", "goal_A"];

        it("should generate voice for equalizer 1 - 1", () => {
            // Arrange
            const restore = mockPickoneIndices([0]);
            
            try {
                // Act
                const actual = generateVoiceWithEventTimeline({
                    eventName,
                    timeline
                }, {
                    draw1: { 1: 1 },
                    goal: { 1: 1 },
                });

                // Assert
                expect(actual.voice).toContain('draw1_1_1');
            } finally {
                restore();
            }
        });

        it("should count score from previous half", () => {
            // Arrange
            const restore = mockPickoneIndices([0]);
            const thisEventName = ["goal_H"];
            try {
                // Act
                const actual = generateVoiceWithEventTimeline({
                    eventName: thisEventName,
                    timeline: [10],
                    firstHalfScore: "A"
                }, {
                    draw1: { 1: 1 },
                    goal: { 1: 1 },
                });

                // Assert
                expect(actual.voice).toEqual(['draw1_1_1']);
            } finally {
                restore();
            }
        });

        it("should not generate unconfigured voice", () => {
            // Arrange
            const thisEventName = ["goal_H"];
            // Act
            const actual = generateVoiceWithEventTimeline({
                eventName: thisEventName,
                timeline: [10],
                firstHalfScore: "A"
            }, {
                goal: { 1: 1 },
            });

            // Assert
            expect(actual.voice).toEqual(['goal_1_1']);
        });


        it("should also randomly generate random goal too", () => {
            // Arrange
            const restore = mockPickoneIndices([0, 0]);
            
            try {
                // Act
                const actual = generateVoiceWithEventTimeline({
                    eventName,
                    timeline
                }, {
                    goal: { 1: 2 },
                });

                // Assert
                expect(actual.voice).toContain('goal_1_2');
                expect(actual.voice).toContain('goal_1_1');
            } finally {
                restore();
            }
        });
    });

    describe("Draw 2 - 2", () => {
        const timeline = [10, 20, 30, 40];
        const eventName = ["goal_H", "goal_A", "goal_H", "goal_A"];

        it("should generate voice for draw 2 - 2", () => {
            // Arrange
            const restore = mockPickoneIndices([0, 0, 0, 0]);
            
            try {
                // Act
                const actual = generateVoiceWithEventTimeline({
                    eventName,
                    timeline
                }, {
                    draw2: { 2: 1 },
                    goal: { 1: 1 },
                });

                // Assert
                expect(actual.voice).toContain('draw2_2_1');
            } finally {
                restore();
            }
        });
    });

    describe("Draw 3 - 3", () => {
        const timeline = [10, 20, 30, 40, 50, 60];
        const eventName = ["goal_H", "goal_A", "goal_H", "goal_A", "goal_H", "goal_A"];

        it("should generate voice for draw 3 - 3", () => {
            // Arrange
            const restore = mockPickoneIndices([0,0, 0,0, 0,0]);
            
            try {
                // Act
                const actual = generateVoiceWithEventTimeline({
                    eventName,
                    timeline
                }, {
                    draw3: { 3: 1 },
                    goal: { 1: 1 },
                });

                // Assert
                expect(actual.voice).toContain('draw3_3_1');
            } finally {
                restore();
            }
        });
    });

    describe("Draw 4 - 4", () => {
        const timeline = [10, 20, 30, 40, 50, 60, 70, 80];
        const eventName = ["goal_H", "goal_A", "goal_H", "goal_A", "goal_H", "goal_A", "goal_H", "goal_A"];

        it("should generate voice for draw 4 - 4", () => {
            // Arrange
            const restore = mockPickoneIndices([0, 0]);
            
            try {
                // Act
                const actual = generateVoiceWithEventTimeline({
                    eventName,
                    timeline
                }, {
                    draw4: { 4: 1 },
                    goal: { 1: 1 },
                });

                // Assert
                expect(actual.voice).toContain('draw4_4_1');
            } finally {
                restore();
            }
        });
    });

    describe("2 Consecutive Goal", () => {
        const timeline = [10, 20];
        const eventName = ["goal_H", "goal_H"];

        it("should generate voice for 2 consecutive goal", () => {
            // Arrange
            const restore = mockPickoneIndices([0, 0]);
            
            try {
                // Act
                const actual = generateVoiceWithEventTimeline({
                    eventName,
                    timeline
                }, {
                    goal2nd: {
                        2: 1,
                        3: 1,
                        4: 1
                    },
                    goal: { 1: 1 },
                })

                // Assert
                expect(actual.voice).toContain('goal2nd_2_1');
            } finally {
                restore();
            }
        });
    });

    describe("3 Consecutive Goal", () => {
        const timeline = [10, 20, 30];
        const eventName = ["goal_H", "goal_H", "goal_H"];

        it("should generate voice for 3 consecutive goal", () => {
            // Arrange
            const restore = mockPickoneIndices([0, 0, 0]);
            
            try {
                // Act
                const actual = generateVoiceWithEventTimeline({
                    eventName,
                    timeline
                }, {
                    goal3rd: {
                        2: 1,
                        3: 1,
                        4: 1
                    },
                    goal: { 1: 1 },
                    
                })

                // Assert
                expect(actual.voice).toContain('goal3rd_2_1');
            } finally {
                restore();
            }
        });

        it("should should count score from previous half", () => {
            // Arrange
            const restore = mockPickoneIndices([0,0, 0,0, 1,0]);
            
            try {
                // Act
                const actual = generateVoiceWithEventTimeline({
                    eventName: ["goal_A", "goal_A", "goal_A"],
                    timeline: [10, 20, 30],
                    firstHalfScore: "HHA"
                }, {
                    goal4th: {
                        1:1
                    },
                    goal3rd: {
                        2: 1,
                        3: 1,
                        4: 1
                    },
                    goal2nd: {
                        1: 1
                    },
                    goal: { 1: 1 },
                });

                // Assert
                expect(actual.voice).toContain('goal4th_1_1');
            } finally {
                restore();
            }
        });
    });

    describe("6 Consecutive Goal", () => {
        const timeline = [10, 20, 30, 40, 50, 60];
        const eventName = ["goal_H", "goal_H", "goal_H", "goal_H", "goal_H", "goal_H"];

        it("should generate voice for 6 consecutive goal", () => {
            // Arrange
            const restore = mockPickoneIndices([0,0, 0,0, 0,0, 0,0, 0,0, 1,0]);
            
            try {
                // Act
                const actual = generateVoiceWithEventTimeline({
                    eventName,
                    timeline
                }, {
                    goal5th: {
                        2: 1,
                        3: 1,
                        4: 1,
                        5: 1
                    },
                    goal: { 1: 1 },
                })

                // Assert
                expect(actual.voice).toContain('goal5th_2_1');
            } finally {
                restore();
            }
        });
    });

    describe("Fast Goal", () => {
        const timeline = [2, 4.3];
        const eventName = ["goal_H", "goal_A"];

        it("should generate voice for fast goal", () => {
            // Arrange
            const restore = mockPickoneIndices([0, 0]);
            
            try {
                // Act
                const actual = generateVoiceWithEventTimeline({
                    eventName,
                    timeline
                }, {
                    fastGoal: { 2: 1 },
                    goal: { 1: 1 },
                })

                // Assert
                expect(actual.voice).toContain('fastGoal_2_1');
            } finally {
                restore();
            }
        });

        it("should not count score from previous half", () => {
            // Arrange
            const restore = mockPickoneIndices([0, 0]);
            
            try {
                // Act
                const actual = generateVoiceWithEventTimeline({
                    eventName: ["goal_H"],
                    timeline: [2],
                    firstHalfScore: "H"
                }, {
                    fastGoal: { 1: 1 },
                })

                // Assert
                expect(actual.voice).toEqual([]);
            } finally {
                restore();
            }
        })
    });

    describe("First Goal", () => {
        const timeline = [2];
        const eventName = ["goal_H"];

        it("should generate voice for first goal on first half", () => {
            // Arrange
            const restore = mockPickoneIndices([0, 0]);

            try {
                // Act
                const actual = generateVoiceWithEventTimeline({
                    eventName,
                    timeline
                }, {
                    firstGoal: { 1: 1 },
                    goal: { 1: 1 },
                })

                // Assert
                expect(actual.voice).toContain('firstGoal_1_1');
            } finally {
                restore();
            }
        });
    });

    describe("Last Goal", () => {
        const timeline = [26];
        const eventName = ["goal_H"];

        it("should generate voice for last goal", () => {
            // Arrange
            const restore = mockPickoneIndices([1, 0]);
            
            try {
                // Act
                const actual = generateVoiceWithEventTimeline({
                    eventName,
                    timeline,
                }, {
                    lastGoal: { 1: 1 }
                })

                // Assert
                expect(actual.voice).toEqual([]);
            } finally {
                restore();
            }
        });
    });

    describe("Glove", () => {
        describe("Overlap with previous goal", () => {
            it("Should not generate voice for glove", () => {
                // Arrange
                const restore = mockPickoneIndices([0, 0]);
                const timeline = [2,4];
                const eventName = ["goal_H", "hit_glove_B"];
                try {
                    // Act
                    const actual = generateVoiceWithEventTimeline({
                        eventName,
                        timeline
                    }, {
                        goal: { 3: 1 },
                        save: { 1: 1 }
                    });

                    // Assert
                    expect(actual.voice).toEqual(['goal_3_1']);
                } finally {
                    restore();
                }
            });
        });

        describe("Overlap with next goal", () => {
            it("Should not generate voice for glove", () => {
                // Arrange
                const restore = mockPickoneIndices([0, 0]);
                const timeline = [2,4];
                const eventName = ["hit_glove_B", "goal_H"];
                try {
                    // Act
                    const actual = generateVoiceWithEventTimeline({
                        eventName,
                        timeline
                    }, {
                        goal: { 1: 1 },
                        save: { 3: 1 }
                    });

                    // Assert
                    expect(actual.voice).toEqual(['goal_1_1']);
                } finally {
                    restore();
                }
            });
        });
    });

    describe("No Goal", () => {
        it("Should generate voice for no goal", () => {
            // Arrange
            const restore = mockPickoneIndices([0, 0, 0, 0]);
            const timeline = [21];
            const eventName = ["goal_H"];
            try {
                // Act
                const actual = generateVoiceWithEventTimeline({
                    eventName,
                    timeline
                }, {
                    goal: { 3: 1 },
                    noGoal: { 1: 1 }
                });

                // Assert
                expect(actual.voice).toEqual(['noGoal_1_1', 'goal_3_1']);
            } finally {
                restore();
            }
        });

        it("Should not overlap next goal", () => {
            // Arrange
            const restore = mockPickoneIndices([0, 0]);
            const timeline = [16];
            const eventName = ["goal_H"];
            try {
                // Act
                const actual = generateVoiceWithEventTimeline({
                    eventName,
                    timeline
                }, {
                    goal: { 1: 1 },
                    noGoal: { 2: 1 }
                });

                // Assert
                expect(actual.voice).toEqual(['goal_1_1']);
            } finally {
                restore();
            }
        });

        it("Should left for previous glove", () => {
            // Arrange
            const restore = mockPickoneIndices([0, 0]);
            const timeline = [14];
            const eventName = ["hit_glove_B"];
            try {
                // Act
                const actual = generateVoiceWithEventTimeline({
                    eventName,
                    timeline
                }, {
                    save: { 2: 1 },
                    noGoal: { 2: 1 }
                });

                // Assert
                expect(actual.voice).toEqual(['save_2_1']);
            } finally {
                restore();
            }
        });
    });

    describe("When time from current event to the next event", () => {
        const timeline = [14, 16];
        const eventName = ["goal_H", "goal_H"];

        describe("There is a voice that has shorter duration than the limit", () => {
            it("should only generate within the limit", () => {
                // Arrange
                const restore = mockPickoneIndices([0, 0]);
                const config = {
                    goal: {
                        1: 1,
                        3: 4,
                        4: 6
                    }
                };
                const param = {
                    eventName,
                    timeline
                }

                // Act
                try {
                    const actual = generateVoiceWithEventTimeline(param, config);

                    // Assert
                    expect(actual.voice).toEqual(['goal_1_1', 'goal_3_1']);
                } finally {
                    restore();
                }
            });
            it("should not generate voice over the limit", () => {
                // Arrange
                const restore = mockPickoneIndices([1, 6]);
                const config = {
                    goal: {
                        1: 1,
                        3: 4,
                        4: 6
                    }
                };
                const param = {
                    eventName,
                    timeline
                }

                // Act
                try {
                    const actual = generateVoiceWithEventTimeline(param, config);

                    // Assert
                    expect(actual.voice).toEqual(['goal_4_2']);
                } finally {
                    restore();
                }
            });
        });
        

        describe("There is no voice that has shorter duration than the limit", () => {
            it("should generate voice for the shortest duration exceed the limit, and therefore overlap next voice", () => {
                // Arrange
                const restore = mockPickoneIndices([0, 6]);
                const config = {
                    goal: {
                        3: 1,
                        4: 6
                    }
                };
                const param = {
                    eventName,
                    timeline
                }

                // Act
                try {
                    const actual = generateVoiceWithEventTimeline(param, config);

                    // Assert
                    expect(actual.voice).toEqual(['goal_3_1']);
                } finally {
                    restore();
                }
            });

            it("should not generate voice other than that", () => {
                // Arrange
                const restore = mockPickoneIndices([1, 2]);
                const config = {
                    goal: {
                        3: 1,
                        4: 6
                    }
                };
                const param = {
                    eventName,
                    timeline
                }

                // Act
                try {
                    const actual = generateVoiceWithEventTimeline(param, config);

                    // Assert
                    expect(actual.voice).toEqual(['goal_4_2']);
                } finally {
                    restore();
                }
            });
        });
    });

    describe("When there is a voice that is already generated", () => {
        it("should not generate the same voice", () => {
            // Arrange
            const restore = mockPickoneIndices([0, 0, 0, 0]);
            const timeline = [14, 20];
            const eventName = ["goal_A", "goal_H"];
            try {
                // Act
                const actual = generateVoiceWithEventTimeline({
                    eventName,
                    timeline
                }, {
                    goal: { 1: 2 }
                });

                // Assert
                expect(actual.voice).toEqual(['goal_1_1', 'goal_1_2']);
            } finally {
                restore();
            }
        });

        it("should not generate voice that is already generated in the first half", () => {
            // Arrange
            const restore = mockPickoneIndices([0]);
            const timeline = [14];
            const eventName = ["goal_A"];
            try {
                // Act
                const actual = generateVoiceWithEventTimeline({
                    eventName,
                    timeline,
                    firstHalfScore: "A",
                    firstHalfVoices: ["goal_1_1"],
                }, {
                    goal: { 1: 2 },
                });

                // Assert
                expect(actual.voice).toEqual(['goal_1_2']);
            } finally {
                restore();
            }
        });
    });

    describe("Debugging test", () => {
        it("error pickone empty array", () => {
            // Arrange
            const events = [ 'goal_H', 'hit_glove_B', 'hit_glove_R', 'hit_glove_B', 'goal_H' ]
            const timeline = [
                8.866666666666667,
                14.866666666666667,
                21.566666666666666,
                27.166666666666668,
                27.8
              ]
            
            const actual = generateVoiceWithEventTimeline({
                eventName: events,
                timeline,
                firstHalfScore: "AAAH",
                firstHalfVoices: [ 'firstGoal_2_6', 'goal2nd_3_3', 'goal3rd_4_3', 'goal_2_2' ]
            }, 
                DEFAULT_VOICE_DURATION_CONFIG);
            console.log(actual);
            expect(actual).toBeDefined();
        });

    });
});